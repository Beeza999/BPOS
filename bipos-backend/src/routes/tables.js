import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth, allowRoles, optionalAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { tableCreateSchema, tableUpdateSchema } from '../lib/schemas.js';
import { ensureBranchBelongsToUser, scopedBranchWhere, httpError } from '../lib/http.js';
import { createTableToken, verifyTableToken } from '../lib/tableToken.js';
import { logAudit } from '../lib/audit.js';
import { emitBranchAndRestaurant } from '../lib/socketEvents.js';

export const tableRouter = Router();

function withQrInfo(table) {
  const tableToken = createTableToken(table);
  const base = process.env.PUBLIC_BASE_URL || '';
  return { ...table, tableToken, qrUrl: `${base}/customer?t=${encodeURIComponent(tableToken)}` };
}

tableRouter.get('/', optionalAuth, async (req, res, next) => {
  try {
    let where = {};

    if (req.query.branchId) {
      if (req.user) await ensureBranchBelongsToUser(req.query.branchId, req.user);
      where = { branchId: String(req.query.branchId) };
    } else if (req.user) {
      where = scopedBranchWhere(req.user);
    } else {
      throw httpError(400, 'branchId is required');
    }

    const tables = await prisma.table.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { branch: true },
    });

    const tableIds = tables.map((table) => table.id);

    const activeOrders = tableIds.length
      ? await prisma.order.findMany({
          where: {
            tableId: { in: tableIds },
            status: { notIn: ['SERVED', 'CANCELLED'] },
          },
          include: {
            items: true,
          },
        })
      : [];

    const ordersByTable = new Map();

    for (const order of activeOrders) {
      const list = ordersByTable.get(order.tableId) || [];
      list.push(order);
      ordersByTable.set(order.tableId, list);
    }

    const fixedTables = tables.map((table) => {
      const orders = ordersByTable.get(table.id) || [];

      let nextStatus = 'AVAILABLE';

      if (orders.length > 0) {
        const items = orders.flatMap((order) =>
          (order.items || []).filter((item) => item.status !== 'CANCELLED')
        );

        const allReady =
          items.length > 0 &&
          items.every((item) => ['READY', 'SERVED'].includes(String(item.status).toUpperCase()));

        nextStatus = allReady ? 'BILLING' : 'OPEN';
      }

      return {
        ...table,
        status: nextStatus,
      };
    });

    const staleTables = fixedTables.filter((table) => {
      const original = tables.find((item) => item.id === table.id);
      return original && original.status !== table.status;
    });

    await Promise.all(
      staleTables.map((table) =>
        prisma.table.update({
          where: { id: table.id },
          data: { status: table.status },
        }).catch(() => null)
      )
    );

    res.json(fixedTables.map(withQrInfo));
  } catch (error) {
    next(error);
  }
});

tableRouter.get('/session/:token', async (req, res, next) => {
  try {
    const tokenData = verifyTableToken(req.params.token);
    const table = await prisma.table.findFirst({ where: { id: tokenData.tableId, branchId: tokenData.branchId, qrCode: tokenData.qrCode }, include: { branch: true } });
    if (!table) throw httpError(404, 'Table not found');
    res.json(withQrInfo(table));
  } catch (error) { next(error); }
});

tableRouter.get('/qr/:qrCode', async (req, res, next) => {
  try {
    const table = await prisma.table.findUnique({ where: { qrCode: req.params.qrCode }, include: { branch: true } });
    if (!table) return res.status(404).json({ error: 'Table not found', qrCode: req.params.qrCode });
    res.json(withQrInfo(table));
  } catch (error) { next(error); }
});

tableRouter.post('/', requireAuth, allowRoles('OWNER', 'ADMIN'), validateBody(tableCreateSchema), async (req, res, next) => {
  try {
    const { name, branchId, seats } = req.body;
    await ensureBranchBelongsToUser(branchId, req.user);
    const qrCode = req.body.qrCode || `qr-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const table = await prisma.table.create({ data: { name: String(name).trim().toUpperCase(), branchId, seats, qrCode, status: 'AVAILABLE' }, include: { branch: true } });
    await logAudit(req, { action: 'TABLE_CREATED', targetType: 'Table', targetId: table.id, branchId, metadata: { name: table.name } });
    emitBranchAndRestaurant(req, { branchId: table.branchId, restaurantId: table.branch?.restaurantId }, 'table:changed', withQrInfo(table));
    res.status(201).json(withQrInfo(table));
  } catch (error) { next(error); }
});

tableRouter.put('/:id', requireAuth, allowRoles('OWNER', 'ADMIN'), validateBody(tableUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.table.findUnique({ where: { id: req.params.id }, include: { branch: true } });
    if (!existing) throw httpError(404, 'Table not found');
    await ensureBranchBelongsToUser(existing.branchId, req.user);
    const data = {};
    if (req.body.name !== undefined) data.name = String(req.body.name).trim().toUpperCase();
    if (req.body.seats !== undefined) data.seats = Number(req.body.seats || 4);
    if (req.body.status !== undefined) data.status = req.body.status;
    const updated = await prisma.table.update({ where: { id: req.params.id }, data, include: { branch: true } });
    await logAudit(req, { action: 'TABLE_UPDATED', targetType: 'Table', targetId: updated.id, branchId: updated.branchId, metadata: data });
    emitBranchAndRestaurant(req, { branchId: updated.branchId, restaurantId: updated.branch?.restaurantId }, 'table:changed', withQrInfo(updated));
    res.json(withQrInfo(updated));
  } catch (error) { next(error); }
});

tableRouter.delete('/:id', requireAuth, allowRoles('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const existing = await prisma.table.findUnique({ where: { id: req.params.id }, include: { branch: true } });
    if (!existing) throw httpError(404, 'Table not found');
    await ensureBranchBelongsToUser(existing.branchId, req.user);
    await prisma.table.delete({ where: { id: req.params.id } });
    await logAudit(req, { action: 'TABLE_DELETED', targetType: 'Table', targetId: req.params.id, branchId: existing.branchId, metadata: { name: existing.name } });
    emitBranchAndRestaurant(req, { branchId: existing.branchId, restaurantId: existing.branch?.restaurantId }, 'table:changed', { id: req.params.id, deleted: true });
    res.json({ success: true });
  } catch (error) { next(error); }
});
