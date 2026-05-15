import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { calcBill } from '../lib/domain.js';
import { httpError, ensureBranchBelongsToUser, SAFE_USER_SELECT } from '../lib/http.js';
import { nextBusinessNumber } from '../lib/sequences.js';
import { createAuditLog } from '../lib/audit.js';

const paymentInclude = {
  order: { include: { table: true, items: true } },
  cashier: { select: SAFE_USER_SELECT },
  shift: true,
};

async function runTransaction(fn) {
  try {
    return await prisma.$transaction(fn);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production' && /Transaction|replica set|transaction/i.test(error.message || '')) {
      console.warn('[payment] transaction unavailable in local dev, falling back to sequential writes:', error.message);
      return fn(prisma);
    }
    throw error;
  }
}

async function getOpenShift(client, user, branchId) {
  return client.shift.findFirst({
    where: { cashierId: user.id, branchId, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });
}

function fallbackIdempotencyKey({ branchId, tableId, orderIds, method, total }) {
  const raw = JSON.stringify({ branchId, tableId, orderIds: [...orderIds].sort(), method, total });
  return `auto:${crypto.createHash('sha256').update(raw).digest('hex')}`;
}

function isDuplicateKeyError(error) {
  const message = `${error?.code || ''} ${error?.message || ''}`;
  return /P2002|E11000|duplicate/i.test(message);
}

function getNotReadyItems(orders) {
  const notReady = [];

  for (const order of orders || []) {
    for (const item of order.items || []) {
      if (String(item.status || '').toUpperCase() !== 'READY') {
        notReady.push({
          orderNumber: order.orderNumber,
          itemName: item.name,
          status: item.status,
        });
      }
    }
  }

  return notReady;
}

async function getBillingSettings(client, restaurantId) {
  const restaurant = await client.restaurant.findUnique({ where: { id: restaurantId } });
  return {
    discountType: restaurant?.discountType || 'amount',
    discountValue: Number(restaurant?.discountValue || 0),
    serviceRate: Number(restaurant?.serviceRate || 0),
    vatRate: Number(restaurant?.taxRate ?? 7),
  };
}

async function findIdempotentPayment(client, key) {
  if (!key) return null;

  const entry = await client.paymentIdempotency.findUnique({
    where: { key },
    include: { payment: { include: paymentInclude } },
  });
  if (entry?.payment) return entry.payment;

  // Compatibility for payments created before the PaymentIdempotency collection existed.
  return client.payment.findFirst({ where: { idempotencyKey: key }, include: paymentInclude });
}

async function reserveIdempotencyKey(client, { key, branchId, tableId, userId }) {
  try {
    return await client.paymentIdempotency.create({
      data: { key, branchId, tableId, createdById: userId },
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const existing = await findIdempotentPayment(client, key);
    if (existing) return { existingPayment: existing };
    throw httpError(409, 'Payment request is already being processed. Please wait and refresh.');
  }
}

async function finishPaidOrders(client, { branchId, tableId, orderIds }) {
  const ids = [...new Set((orderIds || []).map(String))];
  if (!ids.length) return;

  await client.order.updateMany({
    where: {
      id: { in: ids },
      branchId,
      tableId,
      status: { notIn: ['SERVED', 'CANCELLED'] },
    },
    data: { status: 'SERVED' },
  });

  await client.orderItem.updateMany({
    where: {
      orderId: { in: ids },
      status: { notIn: ['SERVED', 'CANCELLED'] },
    },
    data: { status: 'SERVED' },
  });

  const stillOpen = await client.order.count({
    where: { branchId, tableId, status: { notIn: ['SERVED', 'CANCELLED'] } },
  });

  if (stillOpen === 0) {
    await client.table.update({ where: { id: tableId }, data: { status: 'AVAILABLE' } }).catch(() => null);
  }
}

export async function payOrders(req, input) {
  const { tableId, orderIds, method, paidAmount } = input;
  const requestedOrderIds = [...new Set((orderIds || []).map(String))];

  if (!tableId || !requestedOrderIds.length) {
    throw httpError(400, 'Missing table or order list');
  }

  if (input.idempotencyKey) {
    const existing = await findIdempotentPayment(prisma, input.idempotencyKey);
    if (existing) {
      await ensureBranchBelongsToUser(existing.branchId, req.user);

      const existingTableId = existing.order?.tableId || tableId;

      // If the first payment request created the Payment but the browser retried before
      // the order statuses were updated, do not create another payment and do not block
      // the cashier with "Bill has changed". Repair the requested orders and return the
      // same payment. New orders created after payment keep their own unpaid bill.
      await finishPaidOrders(prisma, {
        branchId: existing.branchId,
        tableId: existingTableId,
        orderIds: requestedOrderIds,
      });

      return existing;
    }
  }

  return runTransaction(async (tx) => {
    const targetOrders = await tx.order.findMany({
      where: {
        id: { in: requestedOrderIds },
        tableId,
        status: { notIn: ['SERVED', 'CANCELLED'] },
      },
      include: { items: true, table: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!targetOrders.length) throw httpError(400, 'No unpaid orders found for this table');

    const foundOrderIdSet = new Set(targetOrders.map((order) => String(order.id)));
    const missingRequestedOrders = requestedOrderIds.filter((id) => !foundOrderIdSet.has(id));
    if (missingRequestedOrders.length) {
      throw httpError(409, 'Some selected orders were already paid or changed. Please refresh and try again.');
    }

    const branchId = targetOrders[0].branchId;
    await ensureBranchBelongsToUser(branchId, req.user);
    if (!targetOrders.every((order) => order.branchId === branchId && order.tableId === tableId)) {
      throw httpError(400, 'Orders must belong to the same branch and table');
    }

    const payableOrderIds = targetOrders.map((order) => order.id);

    // Safety for records created by older code: if a PAID payment already exists
    // for any selected order but the order was not marked SERVED, repair the order
    // statuses and return that payment instead of creating a duplicate sale.
    const existingPaymentForOrders = await tx.payment.findFirst({
      where: { branchId, status: 'PAID', orderId: { in: payableOrderIds } },
      include: paymentInclude,
      orderBy: { paidAt: 'desc' },
    });
    if (existingPaymentForOrders) {
      await finishPaidOrders(tx, { branchId, tableId, orderIds: payableOrderIds });
      return existingPaymentForOrders;
    }

    const notReadyItems = getNotReadyItems(targetOrders);
    if (notReadyItems.length) {
      const sample = notReadyItems.slice(0, 3).map((item) => `${item.itemName} (${item.status || 'NEW'})`).join(', ');
      throw httpError(409, `ຍັງຊຳລະບໍ່ໄດ້: ລໍຖ້າ Kitchen ກົດພ້ອມເສີບກ່ອນ (${sample})`);
    }

    const subtotal = targetOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const billingSettings = await getBillingSettings(tx, req.user.restaurantId);
    const calc = calcBill({ subtotal, ...billingSettings, paidAmount });
    if (calc.paidAmount < calc.total) throw httpError(400, 'Paid amount is not enough');

    const idempotencyKey = input.idempotencyKey || fallbackIdempotencyKey({
      branchId,
      tableId,
      orderIds: payableOrderIds,
      method,
      total: calc.total,
    });

    const existing = await findIdempotentPayment(tx, idempotencyKey);
    if (existing) {
      await finishPaidOrders(tx, { branchId: existing.branchId, tableId, orderIds: payableOrderIds });
      return existing;
    }

    const reservation = await reserveIdempotencyKey(tx, {
      key: idempotencyKey,
      branchId,
      tableId,
      userId: req.user.id,
    });
    if (reservation.existingPayment) {
      await finishPaidOrders(tx, { branchId: reservation.existingPayment.branchId, tableId, orderIds: payableOrderIds });
      return reservation.existingPayment;
    }

    const shift = await getOpenShift(tx, req.user, branchId);
    if (!shift) throw httpError(403, 'Open shift is required before accepting payment');

    const billNumber = await nextBusinessNumber({ client: tx, scope: branchId, type: 'bill', prefix: 'BILL', width: 4 });

    const payment = await tx.payment.create({
      data: {
        branchId,
        orderId: payableOrderIds[0],
        cashierId: req.user.id,
        shiftId: shift.id,
        billNumber,
        idempotencyKey,
        method,
        status: 'PAID',
        subtotal: calc.subtotal,
        discount: calc.discount,
        serviceCharge: calc.service,
        vat: calc.vat,
        total: calc.total,
        paidAmount: calc.paidAmount,
        changeAmount: calc.change,
      },
      include: paymentInclude,
    });

    await tx.paymentIdempotency.update({
      where: { key: idempotencyKey },
      data: { paymentId: payment.id },
    });

    await finishPaidOrders(tx, { branchId, tableId, orderIds: payableOrderIds });

    await createAuditLog(tx, req, {
      action: 'PAYMENT_PAID',
      targetType: 'Payment',
      targetId: payment.id,
      branchId,
      metadata: { orderIds: payableOrderIds, requestedOrderIds, method, billNumber, total: calc.total, idempotencyKey, billingSettings },
    });

    return payment;
  });
}

export async function voidPayment(req, paymentId, reason) {
  return runTransaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw httpError(404, 'Payment not found');
    await ensureBranchBelongsToUser(payment.branchId, req.user);
    if (payment.status !== 'PAID') throw httpError(400, 'Only PAID payments can be voided');

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'VOID', voidedAt: new Date(), voidedById: req.user.id, voidReason: reason },
      include: paymentInclude,
    });
    await createAuditLog(tx, req, {
      action: 'PAYMENT_VOIDED',
      targetType: 'Payment',
      targetId: paymentId,
      branchId: payment.branchId,
      reason,
      metadata: { billNumber: payment.billNumber, total: payment.total },
    });
    return updated;
  });
}

export async function refundPayment(req, paymentId, reason) {
  return runTransaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw httpError(404, 'Payment not found');
    await ensureBranchBelongsToUser(payment.branchId, req.user);
    if (payment.status !== 'PAID') throw httpError(400, 'Only PAID payments can be refunded');

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED', refundedAt: new Date(), refundedById: req.user.id, refundReason: reason },
      include: paymentInclude,
    });
    await createAuditLog(tx, req, {
      action: 'PAYMENT_REFUNDED',
      targetType: 'Payment',
      targetId: paymentId,
      branchId: payment.branchId,
      reason,
      metadata: { billNumber: payment.billNumber, total: payment.total },
    });
    return updated;
  });
}
