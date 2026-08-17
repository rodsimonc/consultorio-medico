// Entry point. Serves the front end (appointment booking + admin) and the API /api/v1,
// and starts the email reminder job.
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { runSeed } from './db/seed.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import appointmentRoutes from './routes/appointments.js';
import { errorHandler, notFoundHandler } from './middleware/problem.js';
import { startReminderScheduler, runReminderCheck } from './services/reminder.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

runSeed({ verbose: true });

const app = express();
if (config.trustProxy) app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const v1 = express.Router();
v1.use('/auth', authRoutes);
v1.use('/', catalogRoutes);            // /specialties, /doctors, ...
v1.use('/appointments', appointmentRoutes);
// Helper endpoint to test the reminder without waiting (triggers the check now).
v1.post('/dev/run-reminders', async (req, res) => {
  const now = req.query.now ? Number(req.query.now) : Date.now();
  res.json({ data: await runReminderCheck(now) });
});
app.use('/api/v1', v1);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Salud+ Clinic on http://localhost:${config.port}`);
  console.log(`Appointment booking: /   ·   Admin: /admin.html`);
  startReminderScheduler();
});

export default app;
