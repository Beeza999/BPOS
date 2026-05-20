import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { nextOrderStatus } from '../lib/domain.js';
import { httpError, ensureBranchBelongsToUser } from '../lib/http.js';
import { logAudit } from '../lib/audit.js';
import { emitBranch } from '../lib/socketEvents.js';

export const kitchenRouter = Router();

kitchenRouter.get('/tickets', requireAuth, allowRoles('OWNER', 'ADMIN', 'KITCHEN', 'WAITER'), async (req, res, next) => {
  try {
    const where = {};
    if (req.query.station && req.query.station !== 'all') where.station = String(req.query.station);
    if (req.query.status && req.query.status !== 'all') where.status = String(req.query.status);
    else where.status = { notIn: ['SERVED', 'CANCELLED'] };
    const orderWhere = {};
    if (req.user.role === 'KITCHEN' || req.user.role === 'WAITER') {
      orderWhere.branchId = req.user.branchId;
    } else if (req.query.branchId) {
      const branch = await ensureBranchBelongsToUser(req.query.branchId, req.user);
      orderWhere.branchId = branch.id;
    } else {
      orderWhere.branch = { is: { restaurantId: req.user.restaurantId } };
    }
    if (Object.keys(orderWhere).length) where.order = { is: orderWhere };
    res.json(await prisma.orderItem.findMany({ where, include: { order: { include: { table: true } } }, orderBy: { createdAt: 'asc' } }));
  } catch (error) { next(error); }
});

kitchenRouter.patch('/tickets/:itemId/status', requireAuth, allowRoles('OWNER', 'ADMIN', 'KITCHEN'), async (req, res, next) => {
  try {
    const item = await prisma.orderItem.findUnique({
      where: { id: req.params.itemId },
      include: { order: true },
    });

    if (!item) throw httpError(404, 'Ticket not found');

    await ensureBranchBelongsToUser(item.order.branchId, req.user);

    const status = req.body.status || nextOrderStatus(item.status);

    if (!['NEW', 'ACCEPTED', 'COOKING', 'READY', 'SERVED', 'CANCELLED'].includes(status)) {
      throw httpError(400, 'Invalid status');
    }

    const updated = await prisma.orderItem.update({
      where: { id: req.params.itemId },
      data: { status },
      include: {
        order: {
          include: {
            table: true,
            items: true,
          },
        },
      },
    });

    const siblings = await prisma.orderItem.findMany({
      where: { orderId: updated.orderId },
    });

    const activeSiblings = siblings.filter((item) => item.status !== 'CANCELLED');

    const allItemsReady =
      activeSiblings.length > 0 &&
      activeSiblings.every((item) => item.status === 'READY' || item.status === 'SERVED');

    let orderStatus = status;

    if (allItemsReady) {
      orderStatus = 'READY';
    } else if (activeSiblings.some((item) => item.status === 'COOKING')) {
      orderStatus = 'COOKING';
    } else if (activeSiblings.some((item) => item.status === 'ACCEPTED')) {
      orderStatus = 'ACCEPTED';
    } else if (activeSiblings.some((item) => item.status === 'NEW')) {
      orderStatus = 'NEW';
    }

    const order = await prisma.order.update({
      where: { id: updated.orderId },
      data: { status: orderStatus },
      include: {
        table: true,
        items: true,
      },
    });

    // เช็กทุก order ที่ยังไม่จบของโต๊ะนี้
    const activeOrdersForTable = await prisma.order.findMany({
      where: {
        branchId: order.branchId,
        tableId: order.tableId,
        status: {
          notIn: ['SERVED', 'CANCELLED'],
        },
      },
      include: {
        items: true,
      },
    });

    const activeItemsForTable = activeOrdersForTable.flatMap((activeOrder) =>
      (activeOrder.items || []).filter((orderItem) => orderItem.status !== 'CANCELLED')
    );

    const allTableItemsReady =
      activeItemsForTable.length > 0 &&
      activeItemsForTable.every((orderItem) => orderItem.status === 'READY' || orderItem.status === 'SERVED');

    let tableStatus = 'AVAILABLE';

    if (activeOrdersForTable.length > 0) {
      tableStatus = allTableItemsReady ? 'BILLING' : 'OPEN';
    }

    await prisma.table.update({
      where: { id: order.tableId },
      data: { status: tableStatus },
    }).catch(() => null);

    await logAudit(req, {
      action: 'KITCHEN_TICKET_STATUS_CHANGED',
      targetType: 'OrderItem',
      targetId: updated.id,
      branchId: order.branchId,
      metadata: {
        status,
        orderId: order.id,
        orderStatus,
        tableId: order.tableId,
        tableStatus,
      },
    });

    emitBranch(req, order.branchId, 'kitchen:ticket-status', updated);

    emitBranch(req, order.branchId, 'order:status', {
      ...order,
      status: orderStatus,
      table: {
        ...order.table,
        status: tableStatus,
      },
    });

    emitBranch(req, order.branchId, 'table:status', {
      tableId: order.tableId,
      status: tableStatus,
    });

    res.json({
      ...updated,
      orderStatus,
      tableStatus,
    });
  } catch (error) {
    next(error);
  }
});
