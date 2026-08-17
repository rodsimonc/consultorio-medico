import { db } from '../db/index.js';

function toDomain(r) {
  if (!r) return null;
  return {
    id: r.id, patientId: r.patient_id, doctorId: r.doctor_id, dateTime: r.date_time,
    durationMin: r.duration_min, status: r.status, reason: r.reason,
    reminderSent: !!r.reminder_sent, confirmationToken: r.confirmation_token,
    createdAt: r.created_at, updatedAt: r.updated_at,
    doctorName: r.doctor_name, specialty: r.specialty, patientName: r.patient_name, patientEmail: r.patient_email,
  };
}

const JOIN = `
  SELECT a.*, (d.first_name || ' ' || d.last_name) AS doctor_name, s.name AS specialty,
         (u.first_name || ' ' || u.last_name) AS patient_name, u.email AS patient_email
  FROM appointments a
  JOIN doctors d ON d.id = a.doctor_id
  JOIN specialties s ON s.id = d.specialty_id
  JOIN users u ON u.id = a.patient_id`;

const insert = db.prepare(`INSERT INTO appointments (patient_id, doctor_id, date_time, duration_min, status, reason, reminder_sent, confirmation_token, created_at, updated_at)
  VALUES (@patientId, @doctorId, @dateTime, @durationMin, 'requested', @reason, 0, @token, @now, @now)`);
const byId = db.prepare(`${JOIN} WHERE a.id = ?`);
const byPatient = db.prepare(`${JOIN} WHERE a.patient_id = ? ORDER BY a.date_time DESC LIMIT ? OFFSET ?`);
const all = db.prepare(`${JOIN} ORDER BY a.date_time DESC LIMIT ? OFFSET ?`);
const takenForDoctor = db.prepare("SELECT date_time FROM appointments WHERE doctor_id = ? AND status != 'cancelled'");
const setStatus = db.prepare('UPDATE appointments SET status=@status, updated_at=@now WHERE id=@id');
const dueForReminder = db.prepare(`${JOIN} WHERE a.reminder_sent = 0 AND a.status IN ('requested','confirmed') AND a.date_time >= ? AND a.date_time < ?`);
const markReminder = db.prepare('UPDATE appointments SET reminder_sent=1, updated_at=@now WHERE id=@id');
const byToken = db.prepare('SELECT * FROM appointments WHERE confirmation_token = ?');
const countAll = db.prepare('SELECT COUNT(*) AS n FROM appointments');
const countByPatient = db.prepare('SELECT COUNT(*) AS n FROM appointments WHERE patient_id = ?');

export const appointmentsRepo = {
  // Returns the created appointment, or { error: 'taken' } if the slot is already booked (UNIQUE).
  create(a) {
    const now = new Date().toISOString();
    try {
      const info = insert.run({
        patientId: a.patientId, doctorId: a.doctorId, dateTime: a.dateTime,
        durationMin: a.durationMin || 30, reason: a.reason || '', token: a.token, now,
      });
      return toDomain(byId.get(info.lastInsertRowid));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return { error: 'taken' };
      throw e;
    }
  },
  findById(id) { return toDomain(byId.get(Number(id))); },
  findByPatient(patientId, { limit, offset }) { return byPatient.all(Number(patientId), limit, offset).map(toDomain); },
  findAll({ limit, offset }) { return all.all(limit, offset).map(toDomain); },
  takenSlots(doctorId) { return takenForDoctor.all(Number(doctorId)).map((r) => r.date_time); },
  setStatus(id, status) { setStatus.run({ id: Number(id), status, now: new Date().toISOString() }); return this.findById(id); },
  dueForReminder(fromIso, toIso) { return dueForReminder.all(fromIso, toIso).map(toDomain); },
  markReminderSent(id) { markReminder.run({ id: Number(id), now: new Date().toISOString() }); },
  findByToken(token) { return toDomain(byToken.get(token)); },
  countAll() { return countAll.get().n; },
  countByPatient(id) { return countByPatient.get(Number(id)).n; },
};

export const notificationsRepo = {
  create({ appointmentId, type = 'reminder', recipient, status = 'sent' }) {
    db.prepare('INSERT INTO notifications (appointment_id, type, recipient, sent_at, status) VALUES (?,?,?,?,?)')
      .run(Number(appointmentId), type, recipient, new Date().toISOString(), status);
  },
};
