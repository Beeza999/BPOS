import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { billingSettingsSchema } from '../lib/schemas.js';
import { httpError } from '../lib/http.js';
import { logAudit } from '../lib/audit.js';
import { emitRestaurant } from '../lib/socketEvents.js';

export const settingsRouter = Router();

function normalizeBillingSettings(restaurant) {
  return {
    restaurantId: restaurant.id,
    currency: restaurant.currency || 'LAK',
    discountType: restaurant.discountType || 'amount',
    discountValue: Number(restaurant.discountValue || 0),
    serviceRate: Number(restaurant.serviceRate || 0),
    vatRate: Number(restaurant.taxRate ?? 7),
    updatedAt: restaurant.updatedAt,
  };
}

async function getRestaurantForUser(user) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: user.restaurantId } });
  if (!restaurant) throw httpError(404, 'Restaurant settings not found');
  return restaurant;
}

settingsRouter.get('/billing', requireAuth, allowRoles('OWNER', 'ADMIN', 'CASHIER'), async (req, res, next) => {
  try {
    const restaurant = await getRestaurantForUser(req.user);
    res.json(normalizeBillingSettings(restaurant));
  } catch (error) {
    next(error);
  }
});

settingsRouter.put('/billing', requireAuth, allowRoles('OWNER', 'ADMIN'), validateBody(billingSettingsSchema), async (req, res, next) => {
  try {
    const restaurant = await getRestaurantForUser(req.user);
    const data = {
      discountType: req.body.discountType,
      discountValue: Number(req.body.discountValue || 0),
      serviceRate: Number(req.body.serviceRate || 0),
      taxRate: Number(req.body.vatRate || 0),
    };

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data,
    });

    const payload = normalizeBillingSettings(updated);
    await logAudit(req, {
      action: 'BILLING_SETTINGS_UPDATED',
      targetType: 'Restaurant',
      targetId: restaurant.id,
      metadata: payload,
    });
    emitRestaurant(req, restaurant.id, 'billing:settings', payload);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});
