// Auth: setup del admin (recepción), registro abierto de pacientes, login, perfil.
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
  if (!email || !EMAIL_RE.test(email)) e.push({ field: 'email', message: 'ingresá un email válido (ej: nombre@mail.com)' });
  if (!password || password.length < 8) e.push({ field: 'password', message: 'mínimo 8 caracteres' });
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) e.push({ field: 'password', message: 'debe incluir letras y números' });
  return e;
}
function validatePhone(p) {
  const v = String(p || '').trim();
  if (!v) return null; // opcional
  if (!/^[0-9()+\s-]+$/.test(v) || v.replace(/[^0-9]/g, '').length < 8) return 'teléfono inválido';
  return null;
}
function issue(res, status, user) {
  res.status(status).json({ accessToken: signAccessToken(user), tokenType: 'Bearer', expiresIn: 7200,
    user: { id: user.id, email: user.email, role: user.role, nombre: user.nombre } });
}
function dupOr(e) {
  return String(e.message).includes('UNIQUE')
    ? new ProblemError({ status: 409, title: 'Conflict', detail: 'Ya existe una cuenta con ese email.' }) : e;
}

router.get('/setup-status', (_req, res) => res.json({ needsSetup: usersRepo.countAdmins() === 0 }));

router.post('/register-admin', registerLimiter, (req, res, next) => {
  if (usersRepo.countAdmins() > 0) return next(new ProblemError({ status: 403, title: 'Forbidden', detail: 'Ya existe un administrador.' }));
  const { email, password, nombre } = req.body || {};
  const errors = validateCreds({ email, password });
  if (errors.length) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'Datos inválidos.', extensions: { errors } }));
  try { issue(res, 201, usersRepo.create({ email, passwordHash: hashPassword(password), role: 'admin', nombre: nombre || 'Recepción' })); }
  catch (e) { next(dupOr(e)); }
});

router.post('/register', registerLimiter, (req, res, next) => {
  const { email, password, nombre, apellido, telefono, dni } = req.body || {};
  const errors = validateCreds({ email, password });
  if (!nombre || !String(nombre).trim()) errors.push({ field: 'nombre', message: 'requerido' });
  const pe = validatePhone(telefono);
  if (pe) errors.push({ field: 'telefono', message: pe });
  if (errors.length) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'Datos de registro inválidos.', extensions: { errors } }));
  try {
    issue(res, 201, usersRepo.create({ email, passwordHash: hashPassword(password), role: 'paciente',
      nombre: nombre.trim(), apellido: (apellido || '').trim(), telefono: telefono || '', dni: dni || '' }));
  } catch (e) { next(dupOr(e)); }
});

router.post('/login', loginLimiter, (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'Se requieren email y password.' }));
  const user = usersRepo.findByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) return next(new ProblemError({ status: 401, title: 'Unauthorized', detail: 'Credenciales inválidas.' }));
  issue(res, 200, user);
});

router.get('/me', requireAuth, (req, res, next) => {
  const u = usersRepo.findById(req.user.id);
  if (!u) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Usuario no encontrado.' }));
  res.json({ data: u });
});

export default router;
