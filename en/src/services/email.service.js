// Email sending with nodemailer. If no SMTP is configured, it runs in "demo mode":
// it logs the email to the console instead of sending it (to test without credentials).
import nodemailer from 'nodemailer';
import { config } from '../config.js';

let cached = null;
function getTransport() {
  if (cached !== null) return cached;
  if (config.email.host && config.email.user) {
    cached = nodemailer.createTransport({
      host: config.email.host, port: config.email.port,
      secure: config.email.port === 465,
      auth: { user: config.email.user, pass: config.email.pass },
    });
  } else {
    cached = false; // demo mode
  }
  return cached;
}

export async function sendMail({ to, subject, html }) {
  const t = getTransport();
  if (!t) {
    console.log(`[email:demo] To: ${to} · Subject: "${subject}" (SMTP not configured; not actually sent)`);
    return { ok: true, demo: true };
  }
  await t.sendMail({ from: config.email.from, to, subject, html });
  return { ok: true };
}
