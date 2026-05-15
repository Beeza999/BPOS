import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, allowRoles, optionalAuth } from '../middleware/auth.js';
import { validateBody, createRateLimiter } from '../middleware/validate.js';
import { orderCreateSchema, orderStatusSchema, callStaffSchema, orderCancelSchema } from '../lib/schemas.js';
import { httpError, ensureBranchBelongsToUser } from '../lib/http.js';
import { verifyTableToken } from '../lib/tableToken.js';
import { nextBusinessNumber } from '../lib/sequences.js';
import { logAudit } from '../lib/audit.js';
import { emitBranch, emitTable } from '../lib/socketEvents.js';

export const orderRouter = Router();
const publicOrderLimiter = createRateLimiter({ windowMs: 60000, max: 30 });
const callStaffLimiter = createRateLimiter({ windowMs: 60000, max: 10 });

async function resolveTableForPublic(body) {
  if (body.tableToken) {
    const tokenData = verifyTableToken(body.tableToken);
    const table = await prisma.table.findFirst({ where: { id: tokenData.tableId, branchId: tokenData.branchId, qrCode: tokenData.qrCode }, include: { branch: true } });
    if (!table) throw httpError(400, 'Invalid table token');
    return { table, branchId: table.branchId, tableId: table.id };
  }
  if (process.env.ALLOW_LEGACY_PUBLIC_ORDER === 'true' && body.branchId && body.tableId) {
    const table = await prisma.table.findFirst({ where: { id: body.tableId, branchId: body.branchId }, include: { branch: true } });
    if (!table) throw httpError(400, 'Invalid table for branch');
    return { table, branchId: body.branchId, tableId: body.tableId };
  }
  throw httpError(401, 'Signed table token is required');
}

orderRouter.get('/table/:tableId', optionalAuth, async (req, res, next) => {
  try {
    const tableId = req.params.tableId;
    if (req.user) {
      const table = await prisma.table.findUnique({ where: { id: tableId } });
      if (!table) throw httpError(404, 'Table not found');
      await ensureBranchBelongsToUser(table.branchId, req.user);
    } else {
      const tokenData = verifyTableToken(String(req.query.tableToken || ''));
      if (String(tokenData.tableId) !== String(tableId)) throw httpError(403, 'Forbidden');
    }
    res.json(await prisma.order.findMany({ where: { tableId, status: { notIn: ['SERVED', 'CANCELLED'] } }, include: { table: true, items: true }, orderBy: { createdAt: 'desc' } }));
  } catch (error) { next(error); }
});

orderRouter.post('/', publicOrderLimiter, validateBody(orderCreateSchema), async (req, res, next) => {
  try {
    const { items, note = '' } = req.body;
    const { table, branchId, tableId } = await resolveTableForPublic(req.body);

    const menuIds = [...new Set(items.map((i) => i.menuItemId).filter(Boolean))];
    const menus = await prisma.menuItem.findMany({ where: { id: { in: menuIds }, status: 'ACTIVE', isAvailable: true, restaurantId: table.branch.restaurantId, OR: [{ branchId }, { branchId: null }] } });
    if (menus.length !== menuIds.length) throw httpError(400, 'One or more menu items are unavailable');

    const orderItems = items.map((item) => {
      const menu = menus.find((m) => m.id === item.menuItemId);
      const quantity = Number(item.quantity || item.qty || 1);
      return { menuItemId: menu.id, name: menu.name, price: Number(menu.price), quantity, note: item.note || '', station: menu.station, status: 'NEW' };
    });
    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderNumber = await nextBusinessNumber({ scope: branchId, type: 'order', prefix: 'ORD', width: 4 });
    const order = await prisma.order.create({
      data: { branchId, tableId, orderNumber, note, status: 'NEW', subtotal, total: subtotal, items: { create: orderItems } },
      include: { table: true, items: true },
    });
    await prisma.table.update({ where: { id: tableId }, data: { status: 'OPEN' } }).catch(() => null);
    emitBranch(req, branchId, 'order:new', order);
    emitBranch(req, branchId, 'order:created', order);
    emitTable(req, tableId, 'order:created', order);
    res.status(201).json(order);
  } catch (error) { next(error); }
});

orderRouter.patch('/:id/status', requireAuth, allowRoles('OWNER', 'ADMIN', 'KITCHEN', 'WAITER'), validateBody(orderStatusSchema), async (req, res, next) => {
  try {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) throw httpError(404, 'Order not found');
    await ensureBranchBelongsToUser(existing.branchId, req.user);
    const order = await prisma.order.update({ where: { id: req.params.id }, data: { status: req.body.status }, include: { table: true, items: true } });
    if (req.body.status === 'CANCELLED') {
      await prisma.orderItem.updateMany({ where: { orderId: order.id }, data: { status: 'CANCELLED' } });
    }
    await logAudit(req, { action: 'ORDER_STATUS_CHANGED', targetType: 'Order', targetId: order.id, branchId: order.branchId, metadata: { status: req.body.status } });
    emitBranch(req, order.branchId, 'order:status', order);
    res.json(order);
  } catch (error) { next(error); }
});

orderRouter.post('/:id/cancel', requireAuth, allowRoles('OWNER', 'ADMIN', 'CASHIER', 'WAITER'), validateBody(orderCancelSchema), async (req, res, next) => {
  try {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) throw httpError(404, 'Order not found');
    await ensureBranchBelongsToUser(existing.branchId, req.user);
    if (existing.status === 'SERVED') throw httpError(400, 'Cannot cancel served order');
    const order = await prisma.order.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: req.user.id, cancelReason: req.body.reason },
      include: { table: true, items: true },
    });
    await prisma.orderItem.updateMany({ where: { orderId: order.id }, data: { status: 'CANCELLED' } });
    const stillOpen = await prisma.order.count({ where: { branchId: order.branchId, tableId: order.tableId, status: { notIn: ['SERVED', 'CANCELLED'] } } });
    if (stillOpen === 0) await prisma.table.update({ where: { id: order.tableId }, data: { status: 'AVAILABLE' } }).catch(() => null);
    await logAudit(req, { action: 'ORDER_CANCELLED', targetType: 'Order', targetId: order.id, branchId: order.branchId, reason: req.body.reason });
    emitBranch(req, order.branchId, 'order:cancelled', order);
    emitBranch(req, order.branchId, 'order:status', order);
    res.json(order);
  } catch (error) { next(error); }
});

orderRouter.post('/call-staff', callStaffLimiter, validateBody(callStaffSchema), async (req, res, next) => {
  try {
    const tokenData = verifyTableToken(req.body.tableToken);
    const table = await prisma.table.findFirst({
      where: { id: tokenData.tableId, branchId: tokenData.branchId, qrCode: tokenData.qrCode },
      select: { id: true, name: true, branchId: true },
    });
    if (!table) throw httpError(400, 'Invalid table token');

    const notification = {
      branchId: table.branchId,
      tableId: table.id,
      tableName: req.body.tableName || table.name || '',
      message: req.body.message || 'ລູກຄ້າເອີ້ນພະນັກງານ',
      calledAt: new Date().toISOString(),
    };

    emitBranch(req, notification.branchId, 'staff:call', notification);
    emitTable(req, notification.tableId, 'staff:call', notification);
    res.status(201).json({ success: true, ...notification });
  } catch (error) { next(error); }
});
