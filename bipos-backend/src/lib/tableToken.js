import crypto from 'crypto';
import { httpError } from './http.js';

function getSecret() {
  const secret = process.env.TABLE_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TABLE_TOKEN_SECRET or JWT_SECRET must be at least 32 characters in production');
    }
    return 'local-dev-table-token-secret-change-before-production';
  }
  return secret;
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function unb64url(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createTableToken(table, options = {}) {
  const ttlDays = Number(options.ttlDays || process.env.TABLE_TOKEN_TTL_DAYS || 3650);
  const payload = {
    v: 1,
    branchId: table.branchId,
    tableId: table.id,
    qrCode: table.qrCode,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60,
  };
  const encoded = b64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyTableToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw httpError(401, 'Invalid table token');
  }
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  const a = Buffer.from(signature || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw httpError(401, 'Invalid table token');
  }
  let data;
  try {
    data = JSON.parse(unb64url(payload));
  } catch {
    throw httpError(401, 'Invalid table token');
  }
  if (!data.tableId || !data.branchId || !data.exp || data.exp < Math.floor(Date.now() / 1000)) {
    throw httpError(401, 'Table token expired');
  }
  return data;
}

export function customerUrlForTable(table) {
  const base = process.env.PUBLIC_BASE_URL || '';
  return `${base}/customer?t=${encodeURIComponent(createTableToken(table))}`;
}
