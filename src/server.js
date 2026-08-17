// Punto de entrada. Sirve el front (tienda de turnos + admin) y la API /api/v1,
// y arranca el job de recordatorios por email.
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { runSeed } from './db/seed.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import turnoRoutes from './routes/turnos.js';
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
v1.use('/', catalogRoutes);          // /especialidades, /medicos, ...
v1.use('/turnos', turnoRoutes);
// Endpoint de ayuda para probar el recordatorio sin esperar (dispara el chequeo ahora).
v1.post('/dev/run-recordatorios', async (req, res) => {
  const now = req.query.now ? Number(req.query.now) : Date.now();
  res.json({ data: await runReminderCheck(now) });
});
app.use('/api/v1', v1);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Consultorio Salud+ en http://localhost:${config.port}`);
  console.log(`Tienda de turnos: /   ·   Admin: /admin.html`);
  startReminderScheduler();
});

export default app;
