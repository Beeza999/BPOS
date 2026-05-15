import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'dev-secret' || secret === 'change-this-secret' || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be a strong random value with at least 32 characters in production');
    }
    return 'local-dev-only-secret-change-before-production';
  }
  return secret;
}

export function signUser(user) {
  return jwt.sign({ id: user.id, role: user.role, branchId: user.branchId, restaurantId: user.restaurantId }, jwtSecret(), { expiresIn: '12h' });
}
export function verifyToken(token) { return jwt.verify(token, jwtSecret()); }
export async function hashPin(pin) { return bcrypt.hash(String(pin), 12); }
export async function comparePin(pin, hash) { return bcrypt.compare(String(pin), hash); }
