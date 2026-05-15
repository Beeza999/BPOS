import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { shiftOpenSchema, shiftCloseSchema } from '../lib/schemas.js';
import { calcShiftClose, nonNegativeMoney } from '../lib/domain.js';
import { httpError, pickBranchId, ensureBranchBelongsToUser, scopedBranchWhereFromRequest } from '../lib/http.js';
import { logAudit } from '../lib/audit.js';
import { emitBranch } from '../lib/socketEvents.js';

export const shiftRouter = Router();

function summarizeShiftPayments(payments = []) {
  const paidPayments = payments.filter((payment) => (payment.status || 'PAID') === 'PAID');

  const byPayment = paidPayments.reduce((map, payment) => {
    const method = payment.method || 'UNKNOWN';
    map[method] = (map[method] || 0) + Number(payment.total || 0);
    return map;
  }, {});

  const cashPayments = paidPayments.filter((payment) => payment.method === 'CASH');
  const cashSales = cashPayments.reduce((sum, payment) => sum + Number(payment.total || 0), 0);
  const cashReceived = cashPayments.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  const cashChange = cashPayments.reduce((sum, payment) => sum + Number(payment.changeAmount || 0), 0);
  const totalSales = paidPayments.reduce((sum, payment) => sum + Number(payment.total || 0), 0);

  return {
    cashSales,
    cashReceived,
    cashChange,
    nonCashSales: Math.max(0, totalSales - cashSales),
    totalSales,
    paymentCount: paidPayments.length,
    byPayment,
  };
}

function formatShift(shift) {
  if (!shift) return shift;
  const payments = Array.isArray(shift.payments) ? shift.payments : [];
  const summary = summarizeShiftPayments(payments);
  const expectedCash = shift.expectedCash ?? (Number(shift.openingCash || 0) + summary.cashSales);
  return {
    ...shift,
    cashSales: summary.cashSales,
    cashReceived: summary.cashReceived,
    cashChange: summary.cashChange,
    nonCashSales: summary.nonCashSales,
    totalSales: summary.totalSales,
    paymentCount: summary.paymentCount,
    byPayment: summary.byPayment,
    expectedCash,
    difference: shift.difference ?? (shift.closingCash == null ? null : Number(shift.closingCash || 0) - expectedCash),
  };
}

const shiftInclude = {
  cashier: { select: { id: true, name: true, username: true, role: true } },
  payments: {
    where: { status: 'PAID' },
    select: {
      id: true,
      billNumber: true,
      method: true,
      status: true,
      total: true,
      paidAmount: true,
      changeAmount: true,
      paidAt: true,
      createdAt: true,
    },
    orderBy: { paidAt: 'desc' },
  },
};

shiftRouter.post('/open', requireAuth, allowRoles('OWNER', 'ADMIN', 'CASHIER'), validateBody(shiftOpenSchema), async (req, res, next) => {
  try {
    const branchId = pickBranchId(req);
    await ensureBranchBelongsToUser(branchId, req.user);
    const openingCash = nonNegativeMoney(req.body.openingCash, 'openingCash');

    const oldOpenShift = await prisma.shift.findFirst({ where: { cashierId: req.user.id, branchId, status: 'OPEN' }, include: shiftInclude });
    if (oldOpenShift) return res.json(formatShift(oldOpenShift));

    const shift = await prisma.shift.create({ data: { branchId, cashierId: req.user.id, openingCash, status: 'OPEN' } });
    const fullShift = await prisma.shift.findUnique({ where: { id: shift.id }, include: shiftInclude });
    await logAudit(req, { action: 'SHIFT_OPENED', targetType: 'Shift', targetId: shift.id, branchId, metadata: { openingCash } });
    emitBranch(req, branchId, 'shift:opened', formatShift(fullShift || shift));
    res.status(201).json(formatShift(fullShift || shift));
  } catch (error) { next(error); }
});

shiftRouter.post('/:id/close', requireAuth, allowRoles('OWNER', 'ADMIN', 'CASHIER'), validateBody(shiftCloseSchema), async (req, res, next) => {
  try {
    const shift = await prisma.shift.findUnique({ where: { id: req.params.id } });
    if (!shift) throw httpError(404, 'Shift not found');
    if (shift.status !== 'OPEN') throw httpError(400, 'Shift is already closed');
    if (req.user.role === 'CASHIER' && shift.cashierId !== req.user.id) throw httpError(403, 'Cannot close another cashier shift');
    await ensureBranchBelongsToUser(shift.branchId, req.user);

    const aggregate = await prisma.payment.aggregate({
      where: { shiftId: shift.id, branchId: shift.branchId, method: 'CASH', status: 'PAID' },
      _sum: { total: true },
    });
    const { cashSales, expectedCash, difference } = calcShiftClose({
      openingCash: shift.openingCash,
      cashSales: aggregate._sum.total || 0,
      closingCash: req.body.closingCash,
    });

    await prisma.shift.update({
      where: { id: shift.id },
      data: { status: 'CLOSED', closingCash: req.body.closingCash, expectedCash, difference, closedAt: new Date() },
    });

    const closedWithPayments = await prisma.shift.findUnique({ where: { id: shift.id }, include: shiftInclude });
    const formatted = formatShift(closedWithPayments);

    await logAudit(req, { action: 'SHIFT_CLOSED', targetType: 'Shift', targetId: shift.id, branchId: shift.branchId, metadata: { cashSales, expectedCash, difference, closingCash: req.body.closingCash } });
    emitBranch(req, shift.branchId, 'shift:closed', formatted);

    res.json(formatted);
  } catch (error) { next(error); }
});

shiftRouter.get('/', requireAuth, allowRoles('OWNER', 'ADMIN', 'CASHIER'), async (req, res, next) => {
  try {
    const where = {
      ...(await scopedBranchWhereFromRequest(req)),
      ...(req.query.status ? { status: String(req.query.status) } : {}),
    };

    if (req.user.role === 'CASHIER') {
      where.cashierId = req.user.id;
    }

    const shifts = await prisma.shift.findMany({ where, include: shiftInclude, orderBy: { openedAt: 'desc' } });
    res.json(shifts.map(formatShift));
  } catch (error) { next(error); }
});
