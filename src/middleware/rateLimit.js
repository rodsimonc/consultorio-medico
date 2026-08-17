// Bloque Autenticación: rate limiting en endpoints sensibles (login, contacto).
// Implementación mínima en memoria por IP. En producción usar un store distribuido.

import { ProblemError } from './problem.js';

export function rateLimit({ windowMs, max }) {
  const hits = new Map(); // ip -> { count, resetAt }

  return (req, _res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now > entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return next(
        new ProblemError({
          status: 429,
          title: 'Too Many Requests',
          detail: `Demasiadas solicitudes. Reintentá en ${retryAfter} segundos.`,
          extensions: { retryAfter },
        })
      );
    }
    next();
  };
}
