// Appointments: request (patient), list (mine/all), change status (admin),
// cancel, and confirm/cancel from the email link (by token).
import crypto from 'node:crypto';
import { Router } from 'express';
import { appointmentsRepo } from '../repositories/appointments.repo.js';
import { catalogRepo } from '../repositories/catalog.repo.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ProblemError } from '../middleware/problem.js';
import { slotsFor } from '../services/slots.service.js';

const router = Router();
const STATUSES = ['requested', 'confirmed', 'cancelled', 'attended', 'absent'];

// Request an appointment (authenticated patient).
router.post('/', requireAuth, (req, res, next) => {
  const { doctorId, dateTime, reason } = req.body || {};
  const doctor = doctorId && catalogRepo.doctorById(doctorId);
  const errors = [];
  if (!doctor) errors.push({ field: 'doctorId', message: 'invalid doctor' });
  if (!dateTime) errors.push({ field: 'dateTime', message: 'required' });
  if (errors.length) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'Could not create the appointment.', extensions: { errors } }));

  // Validate the slot is actually offered and free (never trust the client).
  const date = new Date(dateTime).toISOString().slice(0, 10);
  const ranges = catalogRepo.availabilityOf(doctor.id);
  const takenSet = new Set(appointmentsRepo.takenSlots(doctor.id));
  const valid = new Set(slotsFor({ ranges, dateYmd: date, takenSet, nowMs: Date.now() }).map((s) => s.dateTime));
  const isoRequested = new Date(dateTime).toISOString();
  if (!valid.has(isoRequested)) {
    return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: 'That time slot is not available.', extensions: { errors: [{ field: 'dateTime', message: 'not available' }] } }));
  }

  const created = appointmentsRepo.create({
    patientId: req.user.id, doctorId: doctor.id, dateTime: isoRequested,
    durationMin: 30, reason: reason || '', token: crypto.randomUUID(),
  });
  if (created?.error === 'taken') return next(new ProblemError({ status: 409, title: 'Conflict', detail: 'Someone just booked that slot. Please pick another.' }));
  res.status(201).location(`/api/v1/appointments/${created.id}`).json({ data: created });
});

// List: admin sees all; patient sees their own.
router.get('/', requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 50));
  const offset = (page - 1) * pageSize;
  const isAdmin = req.user.role === 'admin';
  const data = isAdmin ? appointmentsRepo.findAll({ limit: pageSize, offset }) : appointmentsRepo.findByPatient(req.user.id, { limit: pageSize, offset });
  const total = isAdmin ? appointmentsRepo.countAll() : appointmentsRepo.countByPatient(req.user.id);
  res.json({ data, meta: { page, pageSize, total } });
});

router.get('/:id', requireAuth, (req, res, next) => {
  const a = appointmentsRepo.findById(req.params.id);
  if (!a) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Appointment not found.' }));
  if (req.user.role !== 'admin' && String(a.patientId) !== String(req.user.id)) return next(new ProblemError({ status: 403, title: 'Forbidden', detail: 'You cannot view this appointment.' }));
  res.json({ data: a });
});

// Change status (admin): confirm, attend, absent, cancel.
router.patch('/:id/status', requireAuth, requireRole('admin'), (req, res, next) => {
  const a = appointmentsRepo.findById(req.params.id);
  if (!a) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Appointment not found.' }));
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return next(new ProblemError({ status: 422, title: 'Unprocessable Entity', detail: `Invalid status. Valid: ${STATUSES.join(', ')}.` }));
  res.json({ data: appointmentsRepo.setStatus(req.params.id, status) });
});

// Cancel (owning patient or admin).
router.delete('/:id', requireAuth, (req, res, next) => {
  const a = appointmentsRepo.findById(req.params.id);
  if (!a) return next(new ProblemError({ status: 404, title: 'Not Found', detail: 'Appointment not found.' }));
  if (req.user.role !== 'admin' && String(a.patientId) !== String(req.user.id)) return next(new ProblemError({ status: 403, title: 'Forbidden', detail: 'You cannot cancel this appointment.' }));
  appointmentsRepo.setStatus(req.params.id, 'cancelled');
  res.status(204).end();
});

// Confirm from the email (no login, by token). Returns simple HTML.
router.get('/:id/confirm', (req, res) => {
  const a = appointmentsRepo.findById(req.params.id);
  if (!a || a.confirmationToken !== req.query.token) return res.status(400).type('html').send(pageMsg('Invalid or expired link.'));
  appointmentsRepo.setStatus(req.params.id, 'confirmed');
  res.type('html').send(pageMsg('✅ Appointment confirmed! See you then.'));
});
router.get('/:id/cancel-token', (req, res) => {
  const a = appointmentsRepo.findById(req.params.id);
  if (!a || a.confirmationToken !== req.query.token) return res.status(400).type('html').send(pageMsg('Invalid or expired link.'));
  appointmentsRepo.setStatus(req.params.id, 'cancelled');
  res.type('html').send(pageMsg('Your appointment was cancelled. You can book a new one anytime.'));
});

function pageMsg(msg) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <body style="font-family:system-ui;background:#eef3fb;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
  <div style="background:#fff;border:1px solid #e2e7f0;border-radius:14px;padding:34px 30px;max-width:420px;text-align:center">
  <h2 style="color:#1f6feb">Salud+ Clinic</h2><p style="font-size:1.1rem">${msg}</p>
  <a href="/" style="color:#1f6feb">Go to home</a></div></body>`;
}

export default router;
