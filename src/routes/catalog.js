// Catálogo: especialidades, médicos y horarios libres. ABM solo admin.
import { Router } from 'express';
import { catalogRepo } from '../repositories/catalog.repo.js';
import { turnosRepo } from '../repositories/turnos.repo.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ProblemError } from '../middleware/problem.js';
import { slotsFor } from '../services/slots.service.js';

const router = Router();

// --- Especialidades ---
router.get('/especialidades', (_req, res) => res.json({ data: catalogRepo.especialidades().filter((e) => e.activa) }));
router.post('/especialidades', requireAuth, requireRole('admin'), (req, res, next) => {
  const { nombre } = req.body || {};
  if (!nombre || !String(nombre).trim()) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'El nombre es requerido.', extensions: { errors: [{ field: 'nombre', message: 'requerido' }] } }));
  try { res.status(201).json({ data: catalogRepo.createEspecialidad({ nombre: nombre.trim(), descripcion: req.body.descripcion }) }); }
  catch (e) { next(String(e.message).includes('UNIQUE') ? new ProblemError({ status: 409, title: 'Conflict', detail: 'Esa especialidad ya existe.' }) : e); }
});

// --- Médicos ---
router.get('/medicos', (req, res) => {
  let list = catalogRepo.medicos().filter((m) => m.activo);
  if (req.query.especialidadId) list = list.filter((m) => String(m.especialidadId) === String(req.query.especialidadId));
  res.json({ data: list });
});
router.post('/medicos', requireAuth, requireRole('admin'), (req, res, next) => {
  const b = req.body || {};
  const errors = [];
  if (!b.nombre) errors.push({ field: 'nombre', message: 'requerido' });
  if (!b.apellido) errors.push({ field: 'apellido', message: 'requerido' });
  if (!b.especialidadId || !catalogRepo.especialidadById(b.especialidadId)) errors.push({ field: 'especialidadId', message: 'especialidad inválida' });
  if (errors.length) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'Médico inválido.', extensions: { errors } }));
  res.status(201).json({ data: catalogRepo.createMedico(b) });
});
router.put('/medicos/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  if (!catalogRepo.medicoById(req.params.id)) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Médico no encontrado.' }));
  res.json({ data: catalogRepo.updateMedico(req.params.id, req.body || {}) });
});
router.delete('/medicos/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  if (!catalogRepo.medicoById(req.params.id)) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Médico no encontrado.' }));
  catalogRepo.removeMedico(req.params.id); res.status(204).end();
});

// --- Disponibilidad (agenda) ---
router.get('/medicos/:id/disponibilidad', (req, res, next) => {
  const medico = catalogRepo.medicoById(req.params.id);
  if (!medico) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Médico no encontrado.' }));
  const fecha = req.query.fecha; // YYYY-MM-DD
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'Indicá ?fecha=YYYY-MM-DD.' }));
  const franjas = catalogRepo.disponibilidadDe(req.params.id);
  const takenSet = new Set(turnosRepo.takenSlots(req.params.id));
  const slots = slotsFor({ franjas, dateYmd: fecha, takenSet, nowMs: Date.now() });
  res.json({ data: { medico, fecha, slots } });
});
router.put('/medicos/:id/disponibilidad', requireAuth, requireRole('admin'), (req, res, next) => {
  if (!catalogRepo.medicoById(req.params.id)) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Médico no encontrado.' }));
  const franjas = Array.isArray(req.body?.franjas) ? req.body.franjas : [];
  res.json({ data: catalogRepo.setDisponibilidad(req.params.id, franjas) });
});

export default router;
