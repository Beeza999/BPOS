import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { shiftOpenSchema, shiftCloseSchema, paymentSchema, takeawayOrderCreateSchema } from '../lib/schemas.js';
import { calcShiftClose, nonNegativeMoney } from '../lib/domain.js';
import { httpError, ensureBranchBelongsToUser } from '../lib/http.js';
import { nextBusinessNumber } from '../lib/sequences.js';
import { payOrders } from '../services/paymentService.js';
import { logAudit } from '../lib/audit.js';
import { emitBranch } from '../lib/socketEvents.js';

export const cashierRouter = Router();

cashierRouter.use(requireAuth, allowRoles('OWNER', 'ADMIN', 'CASHIER'));

const TAKEAWAY_TABLE_NAME = 'ກັບບ້ານ';
const TAKEAWAY_NOTE_PREFIX = 'TAKEAWAY';

async function getOpenShift(user, branchId = user.branchId) {
  return prisma.shift.findFirst({ where: { cashierId: user.id, branchId, status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
}

function isTakeawayOrder(order) {
  return String(order?.note || '').startsWith(TAKEAWAY_NOTE_PREFIX);
}

function itemIsReady(item) {
  return String(item?.status || '').toUpperCase() === 'READY';
}

function buildBillStatus(bill) {
  const totalItems = bill.items.length;
  const readyItems = bill.items.filter(itemIsReady).length;
  const canPay = totalItems > 0 && readyItems === totalItems;

  return {
    ...bill,
    totalItems,
    readyItems,
    canPay,
    notReadyItems: Math.max(0, totalItems - readyItems),
    payLockedReason: canPay ? '' : 'ລໍຖ້າ Kitchen ກົດພ້ອມເສີບຄົບທຸກລາຍການກ່ອນ',
  };
}

async function getOrCreateTakeawayTable(client, branchId) {
  const existing = await client.table.findFirst({ where: { branchId, name: TAKEAWAY_TABLE_NAME } });
  if (existing) return existing;

  const qrCode = `TAKEAWAY-${branchId}`;

  try {
    return await client.table.create({
      data: {
        branchId,
        name: TAKEAWAY_TABLE_NAME,
        seats: 1,
        qrCode,
        status: 'OPEN',
      },
    });
  } catch (error) {
    const createdByRace = await client.table.findFirst({ where: { branchId, name: TAKEAWAY_TABLE_NAME } });
    if (createdByRace) return createdByRace;
    throw error;
  }
}

cashierRouter.get('/me', async (req, res, next) => {
  try {
    const shift = await getOpenShift(req.user);
    res.json({ user: req.user, shift, canSell: !!shift });
  } catch (error) { next(error); }
});

cashierRouter.post('/open-shift', validateBody(shiftOpenSchema), async (req, res, next) => {
  try {
    const branchId = req.user.branchId || req.body.branchId;
    await ensureBranchBelongsToUser(branchId, req.user);
    const oldShift = await getOpenShift(req.user, branchId);
    if (oldShift) return res.json(oldShift);
    const shift = await prisma.shift.create({ data: { branchId, cashierId: req.user.id, openingCash: nonNegativeMoney(req.body.openingCash, 'openingCash'), status: 'OPEN' } });
    await logAudit(req, { action: 'SHIFT_OPENED', targetType: 'Shift', targetId: shift.id, branchId, metadata: { openingCash: shift.openingCash } });
    emitBranch(req, branchId, 'shift:opened', shift);
    res.status(201).json(shift);
  } catch (error) { next(error); }
});

cashierRouter.post('/close-shift', validateBody(shiftCloseSchema), async (req, res, next) => {
  try {
    const shift = await getOpenShift(req.user);
    if (!shift) throw httpError(400, 'No open shift');
    const aggregate = await prisma.payment.aggregate({ where: { shiftId: shift.id, branchId: shift.branchId, method: 'CASH', status: 'PAID' }, _sum: { total: true } });
    const { cashSales, expectedCash, difference } = calcShiftClose({ openingCash: shift.openingCash, cashSales: aggregate._sum.total || 0, closingCash: req.body.closingCash });
    const closed = await prisma.shift.update({ where: { id: shift.id }, data: { status: 'CLOSED', closingCash: req.body.closingCash, expectedCash, difference, closedAt: new Date() } });
    await logAudit(req, { action: 'SHIFT_CLOSED', targetType: 'Shift', targetId: shift.id, branchId: shift.branchId, metadata: { cashSales, expectedCash, difference } });
    emitBranch(req, shift.branchId, 'shift:closed', { ...closed, cashSales, expectedCash, difference });
    res.json({ ...closed, cashSales, expectedCash, difference });
  } catch (error) { next(error); }
});

cashierRouter.get('/bills', async (req, res, next) => {
  try {
    const branchId = req.user.branchId || req.query.branchId;
    await ensureBranchBelongsToUser(branchId, req.user);
    const orders = await prisma.order.findMany({
      where: { branchId, status: { notIn: ['SERVED', 'CANCELLED'] } },
      include: { table: true, items: true },
      orderBy: { createdAt: 'desc' },
    });

    const map = {};

    for (const order of orders) {
      const takeaway = isTakeawayOrder(order);
      const key = takeaway ? `takeaway:${order.id}` : order.tableId;
      const table = takeaway
        ? { ...(order.table || {}), name: `${TAKEAWAY_TABLE_NAME} #${order.orderNumber}` }
        : order.table;

      if (!map[key]) {
        map[key] = {
          id: key,
          tableId: order.tableId,
          table,
          status: 'BILLING',
          isTakeaway: takeaway,
          orders: [],
          items: [],
          total: 0,
          updatedAt: order.updatedAt,
        };
      }

      map[key].orders.push(order);
      map[key].total += Number(order.total || 0);
      if (new Date(order.updatedAt) > new Date(map[key].updatedAt)) map[key].updatedAt = order.updatedAt;

      for (const item of order.items || []) {
        map[key].items.push({
          id: item.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          note: item.note,
          status: item.status,
          station: item.station,
        });
      }
    }

    res.json(Object.values(map).map(buildBillStatus));
  } catch (error) { next(error); }
});

cashierRouter.post('/takeaway-order', validateBody(takeawayOrderCreateSchema), async (req, res, next) => {
  try {
    const branchId = req.user.branchId || req.body.branchId;
    await ensureBranchBelongsToUser(branchId, req.user);

    const shift = await getOpenShift(req.user, branchId);
    if (!shift) throw httpError(403, 'Open shift is required before creating takeaway orders');

    const table = await getOrCreateTakeawayTable(prisma, branchId);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const menuIds = [...new Set(items.map((item) => item.menuItemId).filter(Boolean))];

    const menus = await prisma.menuItem.findMany({
      where: {
        id: { in: menuIds },
        status: 'ACTIVE',
        isAvailable: true,
        restaurantId: req.user.restaurantId,
        OR: [{ branchId }, { branchId: null }],
      },
    });

    if (menus.length !== menuIds.length) throw httpError(400, 'One or more menu items are unavailable');

    const orderItems = items.map((item) => {
      const menu = menus.find((menuItem) => menuItem.id === item.menuItemId);
      const quantity = Number(item.quantity || item.qty || 1);
      return {
        menuItemId: menu.id,
        name: menu.name,
        price: Number(menu.price),
        quantity,
        note: item.note || '',
        station: menu.station,
        status: 'NEW',
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderNumber = await nextBusinessNumber({ scope: branchId, type: 'order', prefix: 'ORD', width: 4 });
    const note = `${TAKEAWAY_NOTE_PREFIX} | ສັ່ງກັບບ້ານ${req.body.note ? ` | ${req.body.note}` : ''}`;

    const order = await prisma.order.create({
      data: {
        branchId,
        tableId: table.id,
        waiterId: req.user.id,
        orderNumber,
        note,
        status: 'NEW',
        subtotal,
        total: subtotal,
        items: { create: orderItems },
      },
      include: { table: true, items: true },
    });

    await prisma.table.update({ where: { id: table.id }, data: { status: 'OPEN' } }).catch(() => null);
    await logAudit(req, { action: 'TAKEAWAY_ORDER_CREATED', targetType: 'Order', targetId: order.id, branchId, metadata: { orderNumber, total: order.total } });
    emitBranch(req, branchId, 'order:new', order);
    emitBranch(req, branchId, 'order:created', order);
    res.status(201).json(order);
  } catch (error) { next(error); }
});

cashierRouter.post('/pay', validateBody(paymentSchema), async (req, res, next) => {
  try {
    const payment = await payOrders(req, req.body);
    emitBranch(req, payment.branchId, 'payment:paid', payment);
    res.status(201).json(payment);
  } catch (error) { next(error); }
});
