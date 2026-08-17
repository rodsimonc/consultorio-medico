// Auth: admin (front desk) setup, open patient registration, login, profile.
import { Router } from 'express';
import { signAccessToken, requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ProblemError } from '../middleware/problem.js';
import { usersRepo } from '../repositories/users.repo.js';
import { hashPassword, verifyPassword } from '../services/password.js';

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8 });
const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8 });
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validateCreds({ email, password }) {
  const e = [];
  if (!email || !EMAIL_RE.test(email)) e.push({ field: 'email', message: 'enter a valid email (e.g. name@mail.com)' });
  if (!password || password.length < 8) e.push({ field: 'password', message: 'at least 8 characters' });
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) e.push({ field: 'password', message: 'must include letters and numbers' });
  return e;
}
function validatePhone(p) {
  const v = String(p || '').trim();
  if (!v) return null; // optional
  if (!/^[0-9()+\s-]+$/.test(v) || v.replace(/[^0-9]/g, '').length < 8) return 'invalid phone number';
  return null;
}
function issue(res, status, user) {
  res.status(status).json({ accessToken: signAccessToken(user), tokenType: 'Bearer', expiresIn: 7200,
    user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName } });
}
function dupOr(e) {
  return String(e.message).includes('UNIQUE')
    ? new ProblemError({ status: 409, title: 'Conflict', detail: 'An account with that email already exists.' }) : e;
}

router.get('/setup-status', (_req, res) => res.json({ needsSetup: usersRepo.countAdmins() === 0 }));

router.post('/register-admin', registerLimiter, (req, res, next) => {
  if (usersRepo.countAdmins() > 0) return next(new ProblemError({ status: 403, title: 'Forbidden', detail: 'An administrator already exists.' }));
  const { email, password, firstName } = req.body || {};
  const errors = validateCreds({ email, password });
  if (errors.length) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'Invalid data.', extensions: { errors } }));
  try { issue(res, 201, usersRepo.create({ email, passwordHash: hashPassword(password), role: 'admin', firstName: firstName || 'Front desk' })); }
  catch (e) { next(dupOr(e)); }
});

router.post('/register', registerLimiter, (req, res, next) => {
  const { email, password, firstName, lastName, phone, nationalId } = req.body || {};
  const errors = validateCreds({ email, password });
  if (!firstName || !String(firstName).trim()) errors.push({ field: 'firstName', message: 'required' });
  const pe = validatePhone(phone);
  if (pe) errors.push({ field: 'phone', message: pe });
  if (errors.length) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'Invalid registration data.', extensions: { errors } }));
  try {
    issue(res, 201, usersRepo.create({ email, passwordHash: hashPassword(password), role: 'patient',
      firstName: firstName.trim(), lastName: (lastName || '').trim(), phone: phone || '', nationalId: nationalId || '' }));
  } catch (e) { next(dupOr(e)); }
});

router.post('/login', loginLimiter, (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'Email and password are required.' }));
  const user = usersRepo.findByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) return next(new ProblemError({ status: 401, title: 'Unauthorized', detail: 'Invalid credentials.' }));
  issue(res, 200, user);
});

router.get('/me', requireAuth, (req, res, next) => {
  const u = usersRepo.findById(req.user.id);
  if (!u) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'User not found.' }));
  res.json({ data: u });
});

export default router;
