// Central configuration read from environment variables (.env in local dev).
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';

export const config = {
  isProd,
  port: Number(process.env.PORT || 3200),

  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-in-production',
  jwtIssuer: process.env.JWT_ISSUER || 'medical-clinic',
  jwtAudience: process.env.JWT_AUDIENCE || 'medical-clinic-users',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '2h',

  databaseFile: process.env.DATABASE_FILE || path.join(root, 'data', 'clinic.db'),

  // Initial admin (front desk) is OPTIONAL; otherwise it is created on first use.
  admin: { email: process.env.ADMIN_EMAIL || null, password: process.env.ADMIN_PASSWORD || null },
  seedSampleData: process.env.SEED_SAMPLE_DATA !== 'false',

  // Public URL of the site (used to build the email links). In local dev, localhost.
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${Number(process.env.PORT || 3200)}`,

  // Email (reminders). If no SMTP is configured, it logs to the console (demo mode).
  email: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'Salud+ Clinic <no-reply@saludplus.example.com>',
  },
  // How often the reminder check runs (ms). Default 15 min.
  reminderIntervalMs: Number(process.env.REMINDER_INTERVAL_MS || 15 * 60 * 1000),

  trustProxy: process.env.TRUST_PROXY === 'true' || isProd,
};

if (isProd && config.jwtSecret.startsWith('dev-insecure')) {
  console.error('[FATAL] JWT_SECRET is not configured in production.');
  process.exit(1);
}
