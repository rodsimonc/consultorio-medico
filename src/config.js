// Configuración por variables de entorno (.env en local).
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';

export const config = {
  isProd,
  port: Number(process.env.PORT || 3200),

  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-cambiar-en-produccion',
  jwtIssuer: process.env.JWT_ISSUER || 'consultorio-medico',
  jwtAudience: process.env.JWT_AUDIENCE || 'consultorio-usuarios',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '2h',

  databaseFile: process.env.DATABASE_FILE || path.join(root, 'data', 'consultorio.db'),

  // Admin (recepción) inicial OPCIONAL; si no, se crea en el primer uso.
  admin: { email: process.env.ADMIN_EMAIL || null, password: process.env.ADMIN_PASSWORD || null },
  seedSampleData: process.env.SEED_SAMPLE_DATA !== 'false',

  // URL pública del sitio (para armar los links del email). En local, localhost.
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${Number(process.env.PORT || 3200)}`,

  // Email (recordatorios). Si no hay SMTP configurado, se registra en consola (modo demo).
  email: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'Consultorio Salud+ <no-reply@saludmas.example.com>',
  },
  // Cada cuánto corre el chequeo de recordatorios (ms). Por defecto 15 min.
  reminderIntervalMs: Number(process.env.REMINDER_INTERVAL_MS || 15 * 60 * 1000),

  trustProxy: process.env.TRUST_PROXY === 'true' || isProd,
};

if (isProd && config.jwtSecret.startsWith('dev-insecure')) {
  console.error('[FATAL] JWT_SECRET no configurado en producción.');
  process.exit(1);
}
