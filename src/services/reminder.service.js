// Recordatorio automático: 1 día antes del turno, envía un email de confirmación.
// Corre como job periódico (setInterval) dentro del mismo proceso del servidor.
import { config } from '../config.js';
import { turnosRepo, notificacionesRepo } from '../repositories/turnos.repo.js';
import { sendMail } from './email.service.js';
import { formatAr } from './slots.service.js';

function buildHtml(t) {
  const confirmar = `${config.publicUrl}/api/v1/turnos/${t.id}/confirmar?token=${t.tokenConfirmacion}`;
  const cancelar = `${config.publicUrl}/api/v1/turnos/${t.id}/cancelar-token?token=${t.tokenConfirmacion}`;
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
    <h2 style="color:#1f6feb">Recordatorio de tu turno</h2>
    <p>Hola ${t.pacienteNombre || ''}, te recordamos tu turno en <strong>Consultorio Salud+</strong>:</p>
    <ul>
      <li><strong>Profesional:</strong> ${t.medicoNombre} (${t.especialidad})</li>
      <li><strong>Fecha y hora:</strong> ${formatAr(t.fechaHora)}</li>
    </ul>
    <p>Por favor confirmá tu asistencia:</p>
    <p>
      <a href="${confirmar}" style="background:#2f8f5b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Confirmar</a>
      &nbsp;
      <a href="${cancelar}" style="background:#fff;color:#b91c1c;border:1px solid #f0cccc;padding:10px 18px;border-radius:8px;text-decoration:none">Cancelar</a>
    </p>
    <p style="color:#888;font-size:12px">Si no reconocés este turno, ignorá este mensaje.</p>
  </div>`;
}

// Busca turnos que caen entre 24 y 25 horas desde "now" y aún no tienen recordatorio.
export async function runReminderCheck(now = Date.now()) {
  const fromIso = new Date(now + 24 * 3600 * 1000).toISOString();
  const toIso = new Date(now + 25 * 3600 * 1000).toISOString();
  const due = turnosRepo.dueForReminder(fromIso, toIso);
  let enviados = 0;
  for (const t of due) {
    try {
      await sendMail({ to: t.pacienteEmail, subject: 'Recordatorio de tu turno — Consultorio Salud+', html: buildHtml(t) });
      turnosRepo.markReminderSent(t.id);
      notificacionesRepo.create({ turnoId: t.id, destinatario: t.pacienteEmail, estado: 'enviado' });
      enviados++;
    } catch (e) {
      notificacionesRepo.create({ turnoId: t.id, destinatario: t.pacienteEmail, estado: 'error' });
    }
  }
  return { revisados: due.length, enviados };
}

export function startReminderScheduler() {
  // Primer chequeo al arrancar, luego cada intervalo configurado.
  runReminderCheck().catch(() => {});
  const timer = setInterval(() => runReminderCheck().catch(() => {}), config.reminderIntervalMs);
  timer.unref?.();
  console.log(`[recordatorios] job activo cada ${Math.round(config.reminderIntervalMs / 60000)} min`);
  return timer;
}
