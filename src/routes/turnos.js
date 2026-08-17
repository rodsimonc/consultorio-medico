// Turnos: solicitar (paciente), listar (mío/todos), cambiar estado (admin),
// cancelar, y confirmar/cancelar desde el link del email (por token).
import crypto from 'node:crypto';
import { Router } from 'express';
import { turnosRepo } from '../repositories/turnos.repo.js';
import { catalogRepo } from '../repositories/catalog.repo.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ProblemError } from '../middleware/problem.js';
import { slotsFor } from '../services/slots.service.js';

const router = Router();
const ESTADOS = ['solicitado', 'confirmado', 'cancelado', 'atendido', 'ausente'];

// Solicitar turno (paciente autenticado).
router.post('/', requireAuth, (req, res, next) => {
  const { medicoId, fechaHora, motivo } = req.body || {};
  const medico = medicoId && catalogRepo.medicoById(medicoId);
  const errors = [];
  if (!medico) errors.push({ field: 'medicoId', message: 'médico inválido' });
  if (!fechaHora) errors.push({ field: 'fechaHora', message: 'requerido' });
  if (errors.length) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'No se pudo crear el turno.', extensions: { errors } }));

  // Validar que el horario sea uno realmente ofrecido y libre (no confiar en el cliente).
  const fecha = new Date(fechaHora).toISOString().slice(0, 10);
  const franjas = catalogRepo.disponibilidadDe(medico.id);
  const takenSet = new Set(turnosRepo.takenSlots(medico.id));
  const validos = new Set(slotsFor({ franjas, dateYmd: fecha, takenSet, nowMs: Date.now() }).map((s) => s.fechaHora));
  const isoPedido = new Date(fechaHora).toISOString();
  if (!validos.has(isoPedido)) {
    return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'Ese horario no está disponible.', extensions: { errors: [{ field: 'fechaHora', message: 'no disponible' }] } }));
  }

  const created = turnosRepo.create({
    pacienteId: req.user.id, medicoId: medico.id, fechaHora: isoPedido,
    duracionMin: 30, motivo: motivo || '', token: crypto.randomUUID(),
  });
  if (created?.error === 'ocupado') return next(new ProblemError({ status: 409, title: 'Conflict', detail: 'Alguien tomó ese horario recién. Elegí otro.' }));
  res.status(201).location(`/api/v1/turnos/${created.id}`).json({ data: created });
});

// Listado: admin ve todos; paciente ve los suyos.
router.get('/', requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 50));
  const offset = (page - 1) * pageSize;
  const isAdmin = req.user.role === 'admin';
  const data = isAdmin ? turnosRepo.findAll({ limit: pageSize, offset }) : turnosRepo.findByPaciente(req.user.id, { limit: pageSize, offset });
  const total = isAdmin ? turnosRepo.countAll() : turnosRepo.countByPaciente(req.user.id);
  res.json({ data, meta: { page, pageSize, total } });
});

router.get('/:id', requireAuth, (req, res, next) => {
  const t = turnosRepo.findById(req.params.id);
  if (!t) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Turno no encontrado.' }));
  if (req.user.role !== 'admin' && String(t.pacienteId) !== String(req.user.id)) return next(new ProblemError({ status: 403, title: 'Forbidden', detail: 'No podés ver este turno.' }));
  res.json({ data: t });
});

// Cambiar estado (admin): confirmar, atender, ausente, cancelar.
router.patch('/:id/estado', requireAuth, requireRole('admin'), (req, res, next) => {
  const t = turnosRepo.findById(req.params.id);
  if (!t) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Turno no encontrado.' }));
  const { estado } = req.body || {};
  if (!ESTADOS.includes(estado)) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: `Estado inválido. Válidos: ${ESTADOS.join(', ')}.` }));
  res.json({ data: turnosRepo.setEstado(req.params.id, estado) });
});

// Cancelar (paciente dueño o admin).
router.delete('/:id', requireAuth, (req, res, next) => {
  const t = turnosRepo.findById(req.params.id);
  if (!t) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Turno no encontrado.' }));
  if (req.user.role !== 'admin' && String(t.pacienteId) !== String(req.user.id)) return next(new ProblemError({ status: 403, title: 'Forbidden', detail: 'No podés cancelar este turno.' }));
  turnosRepo.setEstado(req.params.id, 'cancelado');
  res.status(204).end();
});

// Confirmar desde el email (sin login, por token). Responde HTML simple.
router.get('/:id/confirmar', (req, res) => {
  const t = turnosRepo.findById(req.params.id);
  if (!t || t.tokenConfirmacion !== req.query.token) return res.status(400).type('html').send(pageMsg('Link inválido o vencido.'));
  turnosRepo.setEstado(req.params.id, 'confirmado');
  res.type('html').send(pageMsg('✅ ¡Turno confirmado! Te esperamos.'));
});
router.get('/:id/cancelar-token', (req, res) => {
  const t = turnosRepo.findById(req.params.id);
  if (!t || t.tokenConfirmacion !== req.query.token) return res.status(400).type('html').send(pageMsg('Link inválido o vencido.'));
  turnosRepo.setEstado(req.params.id, 'cancelado');
  res.type('html').send(pageMsg('Tu turno fue cancelado. Podés sacar uno nuevo cuando quieras.'));
});

function pageMsg(msg) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <body style="font-family:system-ui;background:#eef3fb;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
  <div style="background:#fff;border:1px solid #e2e7f0;border-radius:14px;padding:34px 30px;max-width:420px;text-align:center">
  <h2 style="color:#1f6feb">Consultorio Salud+</h2><p style="font-size:1.1rem">${msg}</p>
  <a href="/" style="color:#1f6feb">Ir al inicio</a></div></body>`;
}

export default router;
