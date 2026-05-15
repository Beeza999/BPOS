import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { paymentSchema, paymentActionSchema } from '../lib/schemas.js';
import { scopedBranchWhereFromRequest, SAFE_USER_SELECT } from '../lib/http.js';
import { payOrders, voidPayment, refundPayment } from '../services/paymentService.js';
import { emitBranch } from '../lib/socketEvents.js';

export const paymentRouter = Router();

const paymentInclude = {
  order: { include: { table: true, items: true } },
  cashier: { select: SAFE_USER_SELECT },
  shift: true,
};

paymentRouter.get('/bills', requireAuth, allowRoles('OWNER', 'ADMIN', 'CASHIER'), async (req, res, next) => {
  try {
    const where = {
      ...(await scopedBranchWhereFromRequest(req)),
      status: { notIn: ['CANCELLED', 'SERVED'] },
    };

    const orders = await prisma.order.findMany({ where, include: { table: true, items: true }, orderBy: { createdAt: 'asc' } });
    const grouped = Object.values(orders.reduce((map, order) => {
      const key = order.tableId;
      if (!map[key]) map[key] = { id: key, tableId: key, table: order.table, orders: [], items: [], subtotal: 0, total: 0 };
      map[key].orders.push(order);
      map[key].items.push(...(order.items || []));
      map[key].subtotal += Number(order.total || 0);
      map[key].total += Number(order.total || 0);
      return map;
    }, {}));
    res.json(grouped);
  } catch (error) { next(error); }
});

paymentRouter.post('/pay', requireAuth, allowRoles('OWNER', 'ADMIN', 'CASHIER'), validateBody(paymentSchema), async (req, res, next) => {
  try {
    const payment = await payOrders(req, req.body);
    emitBranch(req, payment.branchId, 'payment:paid', payment);
    res.status(201).json(payment);
  } catch (error) { next(error); }
});

paymentRouter.post('/:id/void', requireAuth, allowRoles('OWNER', 'ADMIN'), validateBody(paymentActionSchema), async (req, res, next) => {
  try {
    const payment = await voidPayment(req, req.params.id, req.body.reason);
    emitBranch(req, payment.branchId, 'payment:voided', payment);
    res.json(payment);
  } catch (error) { next(error); }
});

paymentRouter.post('/:id/refund', requireAuth, allowRoles('OWNER', 'ADMIN'), validateBody(paymentActionSchema), async (req, res, next) => {
  try {
    const payment = await refundPayment(req, req.params.id, req.body.reason);
    emitBranch(req, payment.branchId, 'payment:refunded', payment);
    res.json(payment);
  } catch (error) { next(error); }
});

paymentRouter.get('/', requireAuth, allowRoles('OWNER', 'ADMIN', 'CASHIER'), async (req, res, next) => {
  try {
    const where = await scopedBranchWhereFromRequest(req);
    res.json(await prisma.payment.findMany({ where, include: paymentInclude, orderBy: { paidAt: 'desc' } }));
  } catch (error) { next(error); }
});
