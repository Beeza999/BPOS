import { prisma } from './prisma.js';

function auditData(req, event = {}) {
  const user = req?.user || {};
  return {
    restaurantId: event.restaurantId || user.restaurantId || null,
    branchId: event.branchId || null,
    userId: event.userId || user.id || null,
    role: event.role || user.role || null,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId || null,
    reason: event.reason || null,
    metadata: event.metadata || {},
    ip: req?.ip || null,
    userAgent: req?.get?.('user-agent') || null,
  };
}

export async function createAuditLog(client, req, event) {
  if (!event?.action || !event?.targetType) return null;
  return client.auditLog.create({ data: auditData(req, event) });
}

export async function logAudit(req, event) {
  try {
    return await createAuditLog(prisma, req, event);
  } catch (error) {
    console.warn('[audit] failed to write audit log:', error.message);
    return null;
  }
}
