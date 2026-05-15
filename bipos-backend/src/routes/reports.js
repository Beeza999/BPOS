import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { ensureBranchBelongsToUser, isBranchStaff, scopedBranchWhere, scopedRestaurantWhere, SAFE_USER_SELECT } from '../lib/http.js';

export const reportRouter = Router();

async function buildReportScope(req) {
  const requestedBranchId = req.query.branchId || (isBranchStaff(req.user) ? req.user.branchId : null);

  if (requestedBranchId) {
    const branch = await ensureBranchBelongsToUser(String(requestedBranchId), req.user);
    return {
      branchWhere: { branchId: branch.id },
      menuWhere: { restaurantId: branch.restaurantId, OR: [{ branchId: branch.id }, { branchId: null }] },
    };
  }

  return {
    branchWhere: scopedBranchWhere(req.user),
    menuWhere: scopedRestaurantWhere(req.user),
  };
}

reportRouter.get('/summary', requireAuth, allowRoles('OWNER', 'ADMIN', 'CASHIER'), async (req, res, next) => {
  try {
    const { branchWhere, menuWhere } = await buildReportScope(req);
    const [payments, openOrders, menuItems, tables, allOrders] = await Promise.all([
      prisma.payment.findMany({
        where: branchWhere,
        include: { order: { include: { table: true, items: true } }, cashier: { select: SAFE_USER_SELECT } },
        orderBy: { paidAt: 'desc' },
      }),
      prisma.order.findMany({ where: { ...branchWhere, status: { notIn: ['SERVED', 'CANCELLED'] } }, include: { table: true, items: true } }),
      prisma.menuItem.findMany({ where: menuWhere }),
      prisma.table.findMany({ where: branchWhere }),
      prisma.order.findMany({ where: branchWhere, include: { items: true, table: true } }),
    ]);

    const sales = payments.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const byPayment = payments.reduce((map, p) => {
      const method = p.method || 'UNKNOWN';
      map[method] = (map[method] || 0) + Number(p.total || 0);
      return map;
    }, {});
    const topMenu = {};
    for (const order of allOrders) {
      for (const item of order.items || []) topMenu[item.name] = (topMenu[item.name] || 0) + Number(item.quantity || 1);
    }

    res.json({
      sales,
      billCount: payments.length,
      openTables: new Set(openOrders.map((o) => String(o.tableId))).size,
      activeMenus: menuItems.filter((m) => m.isAvailable && m.status === 'ACTIVE').length,
      tableCount: tables.length,
      byPayment,
      topMenu,
    });
  } catch (error) { next(error); }
});
