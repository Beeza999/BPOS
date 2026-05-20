import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { hashPin } from '../lib/auth.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { userCreateSchema, userUpdateSchema } from '../lib/schemas.js';
import { ensureBranchBelongsToUser, requireSameRestaurant, httpError } from '../lib/http.js';
import { logAudit } from '../lib/audit.js';
import { emitBranchAndRestaurant } from '../lib/socketEvents.js';

export const userRouter = Router();

const ADMIN_ALLOWED_ROLES = new Set(['CASHIER', 'WAITER', 'KITCHEN']);

function stripPrivateUser(user) {
  if (!user) return user;
  const { pinHash, ...safe } = user;
  return safe;
}

function assertCanCreateRole(actor, role) {
  if (actor.role === 'ADMIN' && !ADMIN_ALLOWED_ROLES.has(role)) {
    throw httpError(403, 'ADMIN can create only CASHIER, WAITER, or KITCHEN users');
  }
}

function assertCanUpdateUser(actor, existing, nextRole) {
  if (actor.role === 'ADMIN') {
    if (existing.role === 'OWNER' || existing.role === 'ADMIN') {
      throw httpError(403, 'ADMIN cannot edit OWNER or ADMIN users');
    }
    if (nextRole && !ADMIN_ALLOWED_ROLES.has(nextRole)) {
      throw httpError(403, 'ADMIN cannot assign OWNER or ADMIN role');
    }
  }
}

async function ensureActiveOwnerRemains(existing, data) {
  if (existing.role !== 'OWNER') return;

  const demotingOwner = data.role && data.role !== 'OWNER';
  const disablingOwner = data.status === 'INACTIVE' || data.status === 'DELETED';
  if (!demotingOwner && !disablingOwner) return;

  const otherActiveOwners = await prisma.user.count({
    where: {
      restaurantId: existing.restaurantId,
      role: 'OWNER',
      status: 'ACTIVE',
      id: { not: existing.id },
    },
  });

  if (otherActiveOwners < 1) {
    throw httpError(400, 'At least one active OWNER is required');
  }
}

function normalizeUserBranch(data) {
  if (data.role === 'OWNER') data.branchId = null;
  return data;
}

userRouter.get('/', requireAuth, allowRoles('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const where = { restaurantId: req.user.restaurantId, status: { not: 'DELETED' } };
    if (req.query.branchId) {
      await ensureBranchBelongsToUser(req.query.branchId, req.user);
      where.branchId = String(req.query.branchId);
    }
    const users = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(users.map(stripPrivateUser));
  } catch (error) { next(error); }
});

userRouter.post('/', requireAuth, allowRoles('OWNER', 'ADMIN'), validateBody(userCreateSchema), async (req, res, next) => {
  try {
    const { pin, ...rawData } = req.body;
    assertCanCreateRole(req.user, rawData.role);

    const data = normalizeUserBranch({ ...rawData, restaurantId: rawData.restaurantId || req.user.restaurantId });
    requireSameRestaurant(data, req.user);
    if (data.branchId) await ensureBranchBelongsToUser(data.branchId, req.user);

    const user = await prisma.user.create({ data: { ...data, pinHash: await hashPin(pin) } });
    await logAudit(req, { action: 'USER_CREATED', targetType: 'User', targetId: user.id, branchId: user.branchId, metadata: { username: user.username, role: user.role } });
    const safe = stripPrivateUser(user);
    emitBranchAndRestaurant(req, { branchId: user.branchId, restaurantId: user.restaurantId }, 'user:changed', safe);
    res.status(201).json(safe);
  } catch (error) { next(error); }
});

userRouter.put('/:id', requireAuth, allowRoles('OWNER', 'ADMIN'), validateBody(userUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw httpError(404, 'User not found');
    requireSameRestaurant(existing, req.user);
    assertCanUpdateUser(req.user, existing, req.body.role);

    const data = { ...req.body };
    if (data.pin) { data.pinHash = await hashPin(data.pin); delete data.pin; }
    normalizeUserBranch(data);
    if (data.branchId) await ensureBranchBelongsToUser(data.branchId, req.user);
    await ensureActiveOwnerRemains(existing, data);

    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    await logAudit(req, { action: 'USER_UPDATED', targetType: 'User', targetId: user.id, branchId: user.branchId, metadata: { changed: Object.keys(data), username: user.username, role: user.role } });
    const safe = stripPrivateUser(user);
    emitBranchAndRestaurant(req, { branchId: user.branchId, restaurantId: user.restaurantId }, 'user:changed', safe);
    res.json(safe);
  } catch (error) { next(error); }
});


userRouter.delete('/:id', requireAuth, allowRoles('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw httpError(404, 'User not found');
    requireSameRestaurant(existing, req.user);

    if (existing.id === req.user.id) {
      throw httpError(400, 'Cannot delete your own user while logged in');
    }

    assertCanUpdateUser(req.user, existing);
    await ensureActiveOwnerRemains(existing, { status: 'DELETED' });

    const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: 'DELETED' } });
    await logAudit(req, { action: 'USER_DELETED', targetType: 'User', targetId: user.id, branchId: user.branchId, metadata: { username: user.username, role: user.role } });
    const safe = stripPrivateUser(user);
    emitBranchAndRestaurant(req, { branchId: user.branchId, restaurantId: user.restaurantId }, 'user:changed', { ...safe, deleted: true });
    res.json({ success: true, user: safe });
  } catch (error) { next(error); }
});
