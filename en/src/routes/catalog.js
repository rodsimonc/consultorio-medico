// Catalog: specialties, doctors and free slots. Admin-only CRUD.
import { Router } from 'express';
import { catalogRepo } from '../repositories/catalog.repo.js';
import { appointmentsRepo } from '../repositories/appointments.repo.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ProblemError } from '../middleware/problem.js';
import { slotsFor } from '../services/slots.service.js';

const router = Router();

// --- Specialties ---
router.get('/specialties', (_req, res) => res.json({ data: catalogRepo.specialties().filter((e) => e.active) }));
router.post('/specialties', requireAuth, requireRole('admin'), (req, res, next) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'Name is required.', extensions: { errors: [{ field: 'name', message: 'required' }] } }));
  try { res.status(201).json({ data: catalogRepo.createSpecialty({ name: name.trim(), description: req.body.description }) }); }
  catch (e) { next(String(e.message).includes('UNIQUE') ? new ProblemError({ status: 409, title: 'Conflict', detail: 'That specialty already exists.' }) : e); }
});

// --- Doctors ---
router.get('/doctors', (req, res) => {
  let list = catalogRepo.doctors().filter((m) => m.active);
  if (req.query.specialtyId) list = list.filter((m) => String(m.specialtyId) === String(req.query.specialtyId));
  res.json({ data: list });
});
router.post('/doctors', requireAuth, requireRole('admin'), (req, res, next) => {
  const b = req.body || {};
  const errors = [];
  if (!b.firstName) errors.push({ field: 'firstName', message: 'required' });
  if (!b.lastName) errors.push({ field: 'lastName', message: 'required' });
  if (!b.specialtyId || !catalogRepo.specialtyById(b.specialtyId)) errors.push({ field: 'specialtyId', message: 'invalid specialty' });
  if (errors.length) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'Invalid doctor.', extensions: { errors } }));
  res.status(201).json({ data: catalogRepo.createDoctor(b) });
});
router.put('/doctors/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  if (!catalogRepo.doctorById(req.params.id)) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Doctor not found.' }));
  res.json({ data: catalogRepo.updateDoctor(req.params.id, req.body || {}) });
});
router.delete('/doctors/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  if (!catalogRepo.doctorById(req.params.id)) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Doctor not found.' }));
  catalogRepo.removeDoctor(req.params.id); res.status(204).end();
});

// --- Availability (schedule) ---
router.get('/doctors/:id/availability', (req, res, next) => {
  const doctor = catalogRepo.doctorById(req.params.id);
  if (!doctor) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Doctor not found.' }));
  const date = req.query.date; // YYYY-MM-DD
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'Provide ?date=YYYY-MM-DD.' }));
  const ranges = catalogRepo.availabilityOf(req.params.id);
  const takenSet = new Set(appointmentsRepo.takenSlots(req.params.id));
  const slots = slotsFor({ ranges, dateYmd: date, takenSet, nowMs: Date.now() });
  res.json({ data: { doctor, date, slots } });
});
router.put('/doctors/:id/availability', requireAuth, requireRole('admin'), (req, res, next) => {
  if (!catalogRepo.doctorById(req.params.id)) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Doctor not found.' }));
  const ranges = Array.isArray(req.body?.ranges) ? req.body.ranges : [];
  res.json({ data: catalogRepo.setAvailability(req.params.id, ranges) });
});

export default router;
