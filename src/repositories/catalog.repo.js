// Especialidades, médicos y disponibilidad (agenda).
import { db } from '../db/index.js';

// ---- Especialidades ----
const espAll = db.prepare('SELECT * FROM especialidades ORDER BY nombre');
const espById = db.prepare('SELECT * FROM especialidades WHERE id = ?');
const espInsert = db.prepare('INSERT INTO especialidades (nombre, descripcion, activa) VALUES (@nombre, @descripcion, @activa)');
const espCount = db.prepare('SELECT COUNT(*) AS n FROM especialidades');

// ---- Médicos ----
const medAll = db.prepare(`SELECT m.*, e.nombre AS especialidad_nombre
  FROM medicos m JOIN especialidades e ON e.id = m.especialidad_id ORDER BY m.apellido`);
const medById = db.prepare(`SELECT m.*, e.nombre AS especialidad_nombre
  FROM medicos m JOIN especialidades e ON e.id = m.especialidad_id WHERE m.id = ?`);
const medInsert = db.prepare(`INSERT INTO medicos (nombre, apellido, especialidad_id, matricula, bio, activo)
  VALUES (@nombre, @apellido, @especialidadId, @matricula, @bio, @activo)`);
const medUpdate = db.prepare(`UPDATE medicos SET nombre=@nombre, apellido=@apellido, especialidad_id=@especialidadId,
  matricula=@matricula, bio=@bio, activo=@activo WHERE id=@id`);
const medDelete = db.prepare('DELETE FROM medicos WHERE id = ?');

// ---- Disponibilidad ----
const dispByMedico = db.prepare('SELECT * FROM disponibilidad WHERE medico_id = ? ORDER BY dia_semana, hora_inicio');
const dispInsert = db.prepare(`INSERT INTO disponibilidad (medico_id, dia_semana, hora_inicio, hora_fin, duracion_min)
  VALUES (@medicoId, @diaSemana, @horaInicio, @horaFin, @duracionMin)`);
const dispDeleteByMedico = db.prepare('DELETE FROM disponibilidad WHERE medico_id = ?');

function espDomain(r) { return r && { id: r.id, nombre: r.nombre, descripcion: r.descripcion, activa: !!r.activa }; }
function medDomain(r) {
  return r && {
    id: r.id, nombre: r.nombre, apellido: r.apellido, especialidadId: r.especialidad_id,
    especialidad: r.especialidad_nombre, matricula: r.matricula, bio: r.bio, activo: !!r.activo,
  };
}
function dispDomain(r) {
  return r && { id: r.id, medicoId: r.medico_id, diaSemana: r.dia_semana, horaInicio: r.hora_inicio, horaFin: r.hora_fin, duracionMin: r.duracion_min };
}

export const catalogRepo = {
  // Especialidades
  especialidades() { return espAll.all().map(espDomain); },
  especialidadById(id) { return espDomain(espById.get(Number(id))); },
  createEspecialidad(e) { const i = espInsert.run({ nombre: e.nombre, descripcion: e.descripcion || '', activa: e.activa === false ? 0 : 1 }); return this.especialidadById(i.lastInsertRowid); },
  countEspecialidades() { return espCount.get().n; },

  // Médicos
  medicos() { return medAll.all().map(medDomain); },
  medicoById(id) { return medDomain(medById.get(Number(id))); },
  createMedico(m) {
    const i = medInsert.run({ nombre: m.nombre, apellido: m.apellido, especialidadId: m.especialidadId, matricula: m.matricula || '', bio: m.bio || '', activo: m.activo === false ? 0 : 1 });
    return this.medicoById(i.lastInsertRowid);
  },
  updateMedico(id, m) {
    medUpdate.run({ id: Number(id), nombre: m.nombre, apellido: m.apellido, especialidadId: m.especialidadId, matricula: m.matricula || '', bio: m.bio || '', activo: m.activo === false ? 0 : 1 });
    return this.medicoById(id);
  },
  removeMedico(id) { return medDelete.run(Number(id)).changes > 0; },

  // Disponibilidad
  disponibilidadDe(medicoId) { return dispByMedico.all(Number(medicoId)).map(dispDomain); },
  setDisponibilidad(medicoId, franjas) {
    const tx = db.transaction(() => {
      dispDeleteByMedico.run(Number(medicoId));
      for (const f of franjas) dispInsert.run({ medicoId: Number(medicoId), diaSemana: f.diaSemana, horaInicio: f.horaInicio, horaFin: f.horaFin, duracionMin: f.duracionMin || 30 });
    });
    tx();
    return this.disponibilidadDe(medicoId);
  },
};
