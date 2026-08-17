// Envío de emails con nodemailer. Si no hay SMTP configurado, funciona en
// "modo demo": registra el email en consola en vez de enviarlo (para probar sin credenciales).
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
    cached = false; // modo demo
  }
  return cached;
}

export async function sendMail({ to, subject, html }) {
  const t = getTransport();
  if (!t) {
    console.log(`[email:demo] Para: ${to} · Asunto: "${subject}" (SMTP no configurado; no se envió de verdad)`);
    return { ok: true, demo: true };
  }
  await t.sendMail({ from: config.email.from, to, subject, html });
  return { ok: true };
}
