// Conexión SQLite y esquema del consultorio.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });
export const db = new Database(config.databaseFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'paciente',   -- 'admin' | 'paciente'
    nombre TEXT NOT NULL DEFAULT '',
    apellido TEXT NOT NULL DEFAULT '',
    telefono TEXT NOT NULL DEFAULT '',
    dni TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS especialidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT NOT NULL DEFAULT '',
    activa INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS medicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    especialidad_id INTEGER NOT NULL REFERENCES especialidades(id),
    matricula TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    activo INTEGER NOT NULL DEFAULT 1
  );

  -- Agenda del médico: por día de semana (0=Dom..6=Sáb), franja horaria y duración.
  CREATE TABLE IF NOT EXISTS disponibilidad (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medico_id INTEGER NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
    dia_semana INTEGER NOT NULL,
    hora_inicio TEXT NOT NULL,      -- 'HH:MM'
    hora_fin TEXT NOT NULL,         -- 'HH:MM'
    duracion_min INTEGER NOT NULL DEFAULT 30
  );

  CREATE TABLE IF NOT EXISTS turnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL REFERENCES users(id),
    medico_id INTEGER NOT NULL REFERENCES medicos(id),
    fecha_hora TEXT NOT NULL,       -- ISO UTC
    duracion_min INTEGER NOT NULL DEFAULT 30,
    estado TEXT NOT NULL DEFAULT 'solicitado', -- solicitado|confirmado|cancelado|atendido|ausente
    motivo TEXT NOT NULL DEFAULT '',
    recordatorio_enviado INTEGER NOT NULL DEFAULT 0,
    token_confirmacion TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (medico_id, fecha_hora)   -- impide doble reserva del mismo horario
  );

  CREATE TABLE IF NOT EXISTS notificaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id INTEGER NOT NULL REFERENCES turnos(id),
    tipo TEXT NOT NULL DEFAULT 'recordatorio',
    destinatario TEXT NOT NULL,
    enviado_at TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'enviado'
  );
`);

export default db;
