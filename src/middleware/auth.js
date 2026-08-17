// Autenticación y autorización.
// Bearer token (JWT). Se validan claims iss/aud/exp/sub. Algoritmo fijo HS256.

import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { ProblemError } from './problem.js';

const ALGORITHM = 'HS256';

export function signAccessToken(user) {
  return jwt.sign(
    { role: user.role },
    config.jwtSecret,
    {
      algorithm: ALGORITHM,
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      subject: String(user.id),
      expiresIn: config.accessTokenTtl,
      jwtid: cryptoRandomId(),
    }
  );
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function verify(token) {
  return jwt.verify(token, config.jwtSecret, {
    algorithms: [ALGORITHM], // rechaza alg: none
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
}

// Exige un Bearer token válido. La autorización se valida SIEMPRE en el servidor.
export function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new ProblemError({
      status: 401, title: 'Unauthorized',
      detail: 'Falta el token Bearer en el header Authorization.',
    }));
  }
  try {
    const payload = verify(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return next(new ProblemError({
      status: 401, title: 'Unauthorized',
      detail: 'El token es inválido o expiró.',
    }));
  }
}

// Autenticación OPCIONAL: si viene un token válido setea req.user; si no, sigue anónimo.
export function optionalAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme === 'Bearer' && token) {
    try { const p = verify(token); req.user = { id: p.sub, role: p.role }; } catch { /* ignora */ }
  }
  next();
}

// Exige un rol específico. 403 si el usuario autenticado no tiene permiso.
export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user || req.user.role !== role) {
      return next(new ProblemError({
        status: 403, title: 'Forbidden',
        detail: 'No tenés permisos para realizar esta operación.',
      }));
    }
    next();
  };
}
