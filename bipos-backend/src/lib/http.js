import { prisma } from './prisma.js';

export const BRANCH_STAFF_ROLES = new Set(['CASHIER', 'WAITER', 'KITCHEN']);

export const SAFE_USER_SELECT = {
  id: true,
  restaurantId: true,
  branchId: true,
  name: true,
  username: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function isBranchStaff(user) {
  return BRANCH_STAFF_ROLES.has(user?.role);
}

export function pickBranchId(req) {
  if (isBranchStaff(req.user)) {
    return req.user.branchId;
  }
  return req.body?.branchId || req.query?.branchId || req.user?.branchId;
}

export function requireSameRestaurant(record, user) {
  if (record?.restaurantId && user?.restaurantId && String(record.restaurantId) !== String(user.restaurantId)) {
    throw httpError(403, 'Forbidden');
  }
}

export function requireSameBranch(record, user) {
  if (!record?.branchId || !user) return;
  if (user.role === 'OWNER' || user.role === 'ADMIN') return;
  if (String(record.branchId) !== String(user.branchId)) {
    throw httpError(403, 'Forbidden');
  }
}

export function requireBranchAccess(branchId, user) {
  if (!branchId) throw httpError(400, 'branchId is required');
  if (!user) throw httpError(401, 'Unauthorized');
  if (isBranchStaff(user) && String(branchId) !== String(user.branchId)) {
    throw httpError(403, 'Forbidden');
  }
}

export async function ensureBranchBelongsToUser(branchId, user, client = prisma) {
  requireBranchAccess(branchId, user);
  if (!user?.restaurantId) return null;
  const branch = await client.branch.findUnique({ where: { id: String(branchId) } });
  if (!branch || String(branch.restaurantId) !== String(user.restaurantId)) {
    throw httpError(403, 'Forbidden');
  }
  return branch;
}

export async function resolveScopedBranchId(req, client = prisma) {
  const requestedBranchId = req.query?.branchId || req.body?.branchId || (isBranchStaff(req.user) ? req.user?.branchId : null);
  if (!requestedBranchId) return null;
  const branch = await ensureBranchBelongsToUser(String(requestedBranchId), req.user, client);
  return branch?.id || String(requestedBranchId);
}

export async function scopedBranchWhereFromRequest(req, client = prisma) {
  const branchId = await resolveScopedBranchId(req, client);
  if (branchId) return { branchId };
  return scopedBranchWhere(req.user);
}

export function scopedBranchWhere(user) {
  if (!user) return {};
  if (isBranchStaff(user)) {
    return { branchId: user.branchId };
  }
  return { branch: { is: { restaurantId: user.restaurantId } } };
}

export function scopedRestaurantWhere(user) {
  if (!user?.restaurantId) return {};
  if (isBranchStaff(user)) {
    return { OR: [{ branchId: user.branchId }, { branchId: null }], restaurantId: user.restaurantId };
  }
  return { restaurantId: user.restaurantId };
}
