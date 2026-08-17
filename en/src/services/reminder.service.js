// Automatic reminder: one day before the appointment, sends a confirmation email.
// Runs as a periodic job (setInterval) inside the same server process.
import { config } from '../config.js';
import { appointmentsRepo, notificationsRepo } from '../repositories/appointments.repo.js';
import { sendMail } from './email.service.js';
import { formatAr } from './slots.service.js';

function buildHtml(a) {
  const confirm = `${config.publicUrl}/api/v1/appointments/${a.id}/confirm?token=${a.confirmationToken}`;
  const cancel = `${config.publicUrl}/api/v1/appointments/${a.id}/cancel-token?token=${a.confirmationToken}`;
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
    <h2 style="color:#1f6feb">Appointment reminder</h2>
    <p>Hi ${a.patientName || ''}, this is a reminder of your appointment at <strong>Salud+ Clinic</strong>:</p>
    <ul>
      <li><strong>Provider:</strong> ${a.doctorName} (${a.specialty})</li>
      <li><strong>Date and time:</strong> ${formatAr(a.dateTime)}</li>
    </ul>
    <p>Please confirm your attendance:</p>
    <p>
      <a href="${confirm}" style="background:#2f8f5b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Confirm</a>
      &nbsp;
      <a href="${cancel}" style="background:#fff;color:#b91c1c;border:1px solid #f0cccc;padding:10px 18px;border-radius:8px;text-decoration:none">Cancel</a>
    </p>
    <p style="color:#888;font-size:12px">If you don't recognize this appointment, please ignore this message.</p>
  </div>`;
}

// Finds appointments that fall between 24 and 25 hours from "now" and have no reminder yet.
export async function runReminderCheck(now = Date.now()) {
  const fromIso = new Date(now + 24 * 3600 * 1000).toISOString();
  const toIso = new Date(now + 25 * 3600 * 1000).toISOString();
  const due = appointmentsRepo.dueForReminder(fromIso, toIso);
  let sent = 0;
  for (const a of due) {
    try {
      await sendMail({ to: a.patientEmail, subject: 'Appointment reminder — Salud+ Clinic', html: buildHtml(a) });
      appointmentsRepo.markReminderSent(a.id);
      notificationsRepo.create({ appointmentId: a.id, recipient: a.patientEmail, status: 'sent' });
      sent++;
    } catch (e) {
      notificationsRepo.create({ appointmentId: a.id, recipient: a.patientEmail, status: 'error' });
    }
  }
  return { checked: due.length, sent };
}

export function startReminderScheduler() {
  // First check at startup, then every configured interval.
  runReminderCheck().catch(() => {});
  const timer = setInterval(() => runReminderCheck().catch(() => {}), config.reminderIntervalMs);
  timer.unref?.();
  console.log(`[reminders] job active every ${Math.round(config.reminderIntervalMs / 60000)} min`);
  return timer;
}
