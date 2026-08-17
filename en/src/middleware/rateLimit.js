// Rate limiting for sensitive endpoints (login, registration).
// Minimal in-memory implementation per IP. Use a distributed store in production.
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
      return next(new ProblemError({ status: 429, title: 'Too Many Requests', detail: `Too many requests. Try again in ${retryAfter} seconds.`, extensions: { retryAfter } }));
    }
    next();
  };
}
