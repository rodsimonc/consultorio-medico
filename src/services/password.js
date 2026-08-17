// Hash y verificación de contraseñas con scrypt (incluido en Node, sin dependencias).
// Formato almacenado:  scrypt$<saltHex>$<hashHex>

import crypto from 'node:crypto';

const KEYLEN = 64;
const COST = { N: 16384, r: 8, p: 1 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, KEYLEN, COST);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = crypto.scryptSync(password, salt, expected.length, COST);
    // Comparación en tiempo constante para evitar timing attacks.
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
