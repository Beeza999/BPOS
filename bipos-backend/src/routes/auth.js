import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { comparePin, signUser } from '../lib/auth.js';
import { validateBody, createRateLimiter } from '../middleware/validate.js';
import { loginSchema } from '../lib/schemas.js';
import { logAudit } from '../lib/audit.js';

export const authRouter = Router();
const loginLimiter = createRateLimiter({ windowMs: 60000, max: 10 });

authRouter.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { username, pin } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.status !== 'ACTIVE' || !(await comparePin(pin, user.pinHash))) {
      await logAudit(req, { action: 'LOGIN_FAILED', targetType: 'User', targetId: user?.id || null, restaurantId: user?.restaurantId || null, branchId: user?.branchId || null, metadata: { username } });
      return res.status(401).json({ error: 'Invalid username or PIN' });
    }
    const { pinHash, ...safeUser } = user;
    req.user = safeUser;
    await logAudit(req, { action: 'LOGIN_SUCCESS', targetType: 'User', targetId: user.id, restaurantId: user.restaurantId, branchId: user.branchId, metadata: { username, role: user.role } });
    res.json({ token: signUser(user), user: safeUser });
  } catch (error) { next(error); }
});
