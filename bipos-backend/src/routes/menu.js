import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, allowRoles, optionalAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { categoryCreateSchema, menuItemCreateSchema, menuItemUpdateSchema } from '../lib/schemas.js';
import { guessStation } from '../lib/domain.js';
import { ensureBranchBelongsToUser, requireSameRestaurant, scopedRestaurantWhere, httpError } from '../lib/http.js';
import { logAudit } from '../lib/audit.js';
import { emitBranchAndRestaurant, emitRestaurant } from '../lib/socketEvents.js';

export const menuRouter = Router();

async function getMenuScope(req) {
  const branchId = req.query.branchId ? String(req.query.branchId) : '';

  if (branchId) {
    let branch;
    if (req.user) {
      branch = await ensureBranchBelongsToUser(branchId, req.user);
    } else {
      branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) throw httpError(404, 'Branch not found');
    }

    return {
      branch,
      where: {
        restaurantId: branch.restaurantId,
        OR: [{ branchId: branch.id }, { branchId: null }],
      },
    };
  }

  if (!req.user) throw httpError(400, 'branchId is required');
  return { branch: null, where: scopedRestaurantWhere(req.user) };
}

function categoryCanBeUsedForItem(category, itemBranchId) {
  return !category.branchId || !itemBranchId || String(category.branchId) === String(itemBranchId);
}

menuRouter.get('/categories', optionalAuth, async (req, res, next) => {
  try {
    const scope = await getMenuScope(req);
    const where = { ...scope.where, status: 'ACTIVE' };
    res.json(await prisma.category.findMany({ where, orderBy: { sortOrder: 'asc' } }));
  } catch (error) { next(error); }
});

menuRouter.post('/categories', requireAuth, allowRoles('OWNER', 'ADMIN'), validateBody(categoryCreateSchema), async (req, res, next) => {
  try {
    const data = { ...req.body, restaurantId: req.body.restaurantId || req.user.restaurantId, status: 'ACTIVE' };
    requireSameRestaurant(data, req.user);
    if (data.branchId) await ensureBranchBelongsToUser(data.branchId, req.user);
    const category = await prisma.category.create({ data });
    await logAudit(req, { action: 'CATEGORY_CREATED', targetType: 'Category', targetId: category.id, branchId: category.branchId, metadata: { name: category.name } });
    emitBranchAndRestaurant(req, { branchId: category.branchId, restaurantId: category.restaurantId }, 'category:changed', category);
    emitRestaurant(req, category.restaurantId, 'menu:changed', category);
    res.status(201).json(category);
  } catch (error) { next(error); }
});

menuRouter.get('/items', optionalAuth, async (req, res, next) => {
  try {
    const scope = await getMenuScope(req);
    const where = { ...scope.where, status: 'ACTIVE' };
    if (req.query.available === 'true') where.isAvailable = true;
    res.json(await prisma.menuItem.findMany({ where, include: { category: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }));
  } catch (error) { next(error); }
});

menuRouter.patch('/items/:id/availability', requireAuth, allowRoles('OWNER', 'ADMIN', 'CASHIER'), async (req, res, next) => {
  try {
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
    if (!existing) throw httpError(404, 'Menu item not found');
    requireSameRestaurant(existing, req.user);
    if (existing.branchId) await ensureBranchBelongsToUser(existing.branchId, req.user);

    const item = await prisma.menuItem.update({
      where: { id: req.params.id },
      data: { isAvailable: req.body.isAvailable !== false },
      include: { category: true },
    });

    await logAudit(req, {
      action: 'MENU_ITEM_AVAILABILITY_CHANGED',
      targetType: 'MenuItem',
      targetId: item.id,
      branchId: item.branchId,
      metadata: { isAvailable: item.isAvailable, name: item.name },
    });
    emitBranchAndRestaurant(req, { branchId: item.branchId, restaurantId: item.restaurantId }, 'menu:changed', item);
    res.json(item);
  } catch (error) { next(error); }
});

menuRouter.post('/items', requireAuth, allowRoles('OWNER', 'ADMIN'), validateBody(menuItemCreateSchema), async (req, res, next) => {
  try {
    if (req.body.branchId) await ensureBranchBelongsToUser(req.body.branchId, req.user);
    const category = await prisma.category.findUnique({ where: { id: req.body.categoryId } });
    if (!category) throw httpError(400, 'Category not found');
    requireSameRestaurant(category, req.user);
    if (!categoryCanBeUsedForItem(category, req.body.branchId || null)) {
      throw httpError(400, 'Category does not belong to this branch');
    }

    const data = {
      restaurantId: req.body.restaurantId || req.user.restaurantId,
      branchId: req.body.branchId || null,
      categoryId: req.body.categoryId,
      name: req.body.name,
      description: req.body.description || '',
      price: Number(req.body.price || 0),
      imageUrl: req.body.imageUrl || '',
      station: req.body.station || guessStation(req.body.name, req.body.categoryName),
      isRecommended: Boolean(req.body.isRecommended),
      isAvailable: req.body.isAvailable !== false,
      status: 'ACTIVE',
      ...(req.body.sortOrder !== undefined ? { sortOrder: Number(req.body.sortOrder || 0) } : {}),
    };
    requireSameRestaurant(data, req.user);
    const item = await prisma.menuItem.create({ data, include: { category: true } });
    await logAudit(req, { action: 'MENU_ITEM_CREATED', targetType: 'MenuItem', targetId: item.id, branchId: item.branchId, metadata: { name: item.name, price: item.price } });
    emitBranchAndRestaurant(req, { branchId: item.branchId, restaurantId: item.restaurantId }, 'menu:changed', item);
    res.status(201).json(item);
  } catch (error) { next(error); }
});

menuRouter.put('/items/:id', requireAuth, allowRoles('OWNER', 'ADMIN'), validateBody(menuItemUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
    if (!existing) throw httpError(404, 'Menu item not found');
    requireSameRestaurant(existing, req.user);
    if (existing.branchId) await ensureBranchBelongsToUser(existing.branchId, req.user);

    const data = {};
    const body = req.body;
    if (body.branchId !== undefined) {
      if (body.branchId) await ensureBranchBelongsToUser(body.branchId, req.user);
      data.branchId = body.branchId || null;
    }

    if (body.categoryId !== undefined) {
      const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
      if (!category) throw httpError(400, 'Category not found');
      requireSameRestaurant(category, req.user);
      const targetBranchId = data.branchId !== undefined ? data.branchId : existing.branchId;
      if (!categoryCanBeUsedForItem(category, targetBranchId)) {
        throw httpError(400, 'Category does not belong to this branch');
      }
      data.categoryId = body.categoryId;
    }

    for (const field of ['name', 'description', 'imageUrl', 'station', 'status']) {
      if (body[field] !== undefined) data[field] = body[field];
    }
    if (body.price !== undefined) data.price = Number(body.price || 0);
    if (body.isRecommended !== undefined) data.isRecommended = Boolean(body.isRecommended);
    if (body.isAvailable !== undefined) data.isAvailable = Boolean(body.isAvailable);
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder || 0);

    const item = await prisma.menuItem.update({ where: { id: req.params.id }, data, include: { category: true } });
    await logAudit(req, { action: 'MENU_ITEM_UPDATED', targetType: 'MenuItem', targetId: item.id, branchId: item.branchId, metadata: data });
    emitBranchAndRestaurant(req, { branchId: item.branchId, restaurantId: item.restaurantId }, 'menu:changed', item);
    res.json(item);
  } catch (error) { next(error); }
});

menuRouter.delete('/items/:id', requireAuth, allowRoles('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
    if (!existing) throw httpError(404, 'Menu item not found');
    requireSameRestaurant(existing, req.user);
    if (existing.branchId) await ensureBranchBelongsToUser(existing.branchId, req.user);
    const item = await prisma.menuItem.update({ where: { id: req.params.id }, data: { status: 'INACTIVE', isAvailable: false } });
    await logAudit(req, { action: 'MENU_ITEM_DELETED', targetType: 'MenuItem', targetId: item.id, branchId: item.branchId, metadata: { name: item.name } });
    emitBranchAndRestaurant(req, { branchId: item.branchId, restaurantId: item.restaurantId }, 'menu:changed', item);
    res.json(item);
  } catch (error) { next(error); }
});
