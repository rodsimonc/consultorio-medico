// Specialties, doctors and availability (schedule).
import { db } from '../db/index.js';

// ---- Specialties ----
const specAll = db.prepare('SELECT * FROM specialties ORDER BY name');
const specById = db.prepare('SELECT * FROM specialties WHERE id = ?');
const specInsert = db.prepare('INSERT INTO specialties (name, description, active) VALUES (@name, @description, @active)');
const specCount = db.prepare('SELECT COUNT(*) AS n FROM specialties');

// ---- Doctors ----
const docAll = db.prepare(`SELECT d.*, s.name AS specialty_name
  FROM doctors d JOIN specialties s ON s.id = d.specialty_id ORDER BY d.last_name`);
const docById = db.prepare(`SELECT d.*, s.name AS specialty_name
  FROM doctors d JOIN specialties s ON s.id = d.specialty_id WHERE d.id = ?`);
const docInsert = db.prepare(`INSERT INTO doctors (first_name, last_name, specialty_id, license, bio, active)
  VALUES (@firstName, @lastName, @specialtyId, @license, @bio, @active)`);
const docUpdate = db.prepare(`UPDATE doctors SET first_name=@firstName, last_name=@lastName, specialty_id=@specialtyId,
  license=@license, bio=@bio, active=@active WHERE id=@id`);
const docDelete = db.prepare('DELETE FROM doctors WHERE id = ?');

// ---- Availability ----
const availByDoctor = db.prepare('SELECT * FROM availability WHERE doctor_id = ? ORDER BY day_of_week, start_time');
const availInsert = db.prepare(`INSERT INTO availability (doctor_id, day_of_week, start_time, end_time, slot_minutes)
  VALUES (@doctorId, @dayOfWeek, @startTime, @endTime, @slotMinutes)`);
const availDeleteByDoctor = db.prepare('DELETE FROM availability WHERE doctor_id = ?');

function specDomain(r) { return r && { id: r.id, name: r.name, description: r.description, active: !!r.active }; }
function docDomain(r) {
  return r && {
    id: r.id, firstName: r.first_name, lastName: r.last_name, specialtyId: r.specialty_id,
    specialty: r.specialty_name, license: r.license, bio: r.bio, active: !!r.active,
  };
}
function availDomain(r) {
  return r && { id: r.id, doctorId: r.doctor_id, dayOfWeek: r.day_of_week, startTime: r.start_time, endTime: r.end_time, slotMinutes: r.slot_minutes };
}

export const catalogRepo = {
  // Specialties
  specialties() { return specAll.all().map(specDomain); },
  specialtyById(id) { return specDomain(specById.get(Number(id))); },
  createSpecialty(e) { const i = specInsert.run({ name: e.name, description: e.description || '', active: e.active === false ? 0 : 1 }); return this.specialtyById(i.lastInsertRowid); },
  countSpecialties() { return specCount.get().n; },

  // Doctors
  doctors() { return docAll.all().map(docDomain); },
  doctorById(id) { return docDomain(docById.get(Number(id))); },
  createDoctor(m) {
    const i = docInsert.run({ firstName: m.firstName, lastName: m.lastName, specialtyId: m.specialtyId, license: m.license || '', bio: m.bio || '', active: m.active === false ? 0 : 1 });
    return this.doctorById(i.lastInsertRowid);
  },
  updateDoctor(id, m) {
    docUpdate.run({ id: Number(id), firstName: m.firstName, lastName: m.lastName, specialtyId: m.specialtyId, license: m.license || '', bio: m.bio || '', active: m.active === false ? 0 : 1 });
    return this.doctorById(id);
  },
  removeDoctor(id) { return docDelete.run(Number(id)).changes > 0; },

  // Availability
  availabilityOf(doctorId) { return availByDoctor.all(Number(doctorId)).map(availDomain); },
  setAvailability(doctorId, ranges) {
    const tx = db.transaction(() => {
      availDeleteByDoctor.run(Number(doctorId));
      for (const f of ranges) availInsert.run({ doctorId: Number(doctorId), dayOfWeek: f.dayOfWeek, startTime: f.startTime, endTime: f.endTime, slotMinutes: f.slotMinutes || 30 });
    });
    tx();
    return this.availabilityOf(doctorId);
  },
};
