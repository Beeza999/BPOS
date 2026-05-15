import { verifyToken } from '../lib/auth.js';

function tokenFromRequest(req) {
  return req.headers.authorization?.replace('Bearer ', '').trim() || '';
}

export function attachUserFromToken(req) {
  const token = tokenFromRequest(req);
  if (!token) return null;
  const payload = verifyToken(token);
  req.user = payload;
  return payload;
}

export function optionalAuth(req, _res, next) {
  try {
    attachUserFromToken(req);
    next();
  } catch {
    req.user = null;
    next();
  }
}

export function requireAuth(req, res, next) {
  try {
    const user = attachUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
