export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request body', details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    }
    req.body = result.data;
    return next();
  };
}

export function createRateLimiter({ windowMs = 60000, max = 30 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${req.path}`;
    const entry = hits.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count += 1;
    hits.set(key, entry);
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests' });
    }
    return next();
  };
}
