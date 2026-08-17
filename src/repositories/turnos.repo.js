import { db } from '../db/index.js';

function toDomain(r) {
  if (!r) return null;
  return {
    id: r.id, pacienteId: r.paciente_id, medicoId: r.medico_id, fechaHora: r.fecha_hora,
    duracionMin: r.duracion_min, estado: r.estado, motivo: r.motivo,
    recordatorioEnviado: !!r.recordatorio_enviado, tokenConfirmacion: r.token_confirmacion,
    createdAt: r.created_at, updatedAt: r.updated_at,
    medicoNombre: r.medico_nombre, especialidad: r.especialidad, pacienteNombre: r.paciente_nombre, pacienteEmail: r.paciente_email,
  };
}

const JOIN = `
  SELECT t.*, (m.nombre || ' ' || m.apellido) AS medico_nombre, e.nombre AS especialidad,
         (u.nombre || ' ' || u.apellido) AS paciente_nombre, u.email AS paciente_email
  FROM turnos t
  JOIN medicos m ON m.id = t.medico_id
  JOIN especialidades e ON e.id = m.especialidad_id
  JOIN users u ON u.id = t.paciente_id`;

const insert = db.prepare(`INSERT INTO turnos (paciente_id, medico_id, fecha_hora, duracion_min, estado, motivo, recordatorio_enviado, token_confirmacion, created_at, updated_at)
  VALUES (@pacienteId, @medicoId, @fechaHora, @duracionMin, 'solicitado', @motivo, 0, @token, @now, @now)`);
const byId = db.prepare(`${JOIN} WHERE t.id = ?`);
const byPaciente = db.prepare(`${JOIN} WHERE t.paciente_id = ? ORDER BY t.fecha_hora DESC LIMIT ? OFFSET ?`);
const all = db.prepare(`${JOIN} ORDER BY t.fecha_hora DESC LIMIT ? OFFSET ?`);
const takenForMedico = db.prepare("SELECT fecha_hora FROM turnos WHERE medico_id = ? AND estado != 'cancelado'");
const setEstado = db.prepare('UPDATE turnos SET estado=@estado, updated_at=@now WHERE id=@id');
const dueForReminder = db.prepare(`${JOIN} WHERE t.recordatorio_enviado = 0 AND t.estado IN ('solicitado','confirmado') AND t.fecha_hora >= ? AND t.fecha_hora < ?`);
const markReminder = db.prepare('UPDATE turnos SET recordatorio_enviado=1, updated_at=@now WHERE id=@id');
const byToken = db.prepare('SELECT * FROM turnos WHERE token_confirmacion = ?');
const countAll = db.prepare('SELECT COUNT(*) AS n FROM turnos');
const countByPaciente = db.prepare('SELECT COUNT(*) AS n FROM turnos WHERE paciente_id = ?');

export const turnosRepo = {
  // Devuelve el turno creado, o {error:'ocupado'} si el horario ya está tomado (UNIQUE).
  create(t) {
    const now = new Date().toISOString();
    try {
      const info = insert.run({
        pacienteId: t.pacienteId, medicoId: t.medicoId, fechaHora: t.fechaHora,
        duracionMin: t.duracionMin || 30, motivo: t.motivo || '', token: t.token, now,
      });
      return toDomain(byId.get(info.lastInsertRowid));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return { error: 'ocupado' };
      throw e;
    }
  },
  findById(id) { return toDomain(byId.get(Number(id))); },
  findByPaciente(pacienteId, { limit, offset }) { return byPaciente.all(Number(pacienteId), limit, offset).map(toDomain); },
  findAll({ limit, offset }) { return all.all(limit, offset).map(toDomain); },
  takenSlots(medicoId) { return takenForMedico.all(Number(medicoId)).map((r) => r.fecha_hora); },
  setEstado(id, estado) { setEstado.run({ id: Number(id), estado, now: new Date().toISOString() }); return this.findById(id); },
  dueForReminder(fromIso, toIso) { return dueForReminder.all(fromIso, toIso).map(toDomain); },
  markReminderSent(id) { markReminder.run({ id: Number(id), now: new Date().toISOString() }); },
  findByToken(token) { return toDomain(byToken.get(token)); },
  countAll() { return countAll.get().n; },
  countByPaciente(id) { return countByPaciente.get(Number(id)).n; },
};

export const notificacionesRepo = {
  create({ turnoId, tipo = 'recordatorio', destinatario, estado = 'enviado' }) {
    db.prepare('INSERT INTO notificaciones (turno_id, tipo, destinatario, enviado_at, estado) VALUES (?,?,?,?,?)')
      .run(Number(turnoId), tipo, destinatario, new Date().toISOString(), estado);
  },
};
