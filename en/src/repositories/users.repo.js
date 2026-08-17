import { db } from '../db/index.js';

const byEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const byId = db.prepare('SELECT * FROM users WHERE id = ?');
const insert = db.prepare(`INSERT INTO users (email, password_hash, role, first_name, last_name, phone, national_id, created_at)
  VALUES (@email, @passwordHash, @role, @firstName, @lastName, @phone, @nationalId, @createdAt)`);
const countAdmins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'");

function pub(r) {
  if (!r) return null;
  return { id: r.id, email: r.email, role: r.role, firstName: r.first_name, lastName: r.last_name, phone: r.phone, nationalId: r.national_id };
}

export const usersRepo = {
  findByEmail(email) {
    const r = byEmail.get(String(email).trim().toLowerCase());
    return r ? { ...pub(r), passwordHash: r.password_hash } : null;
  },
  findById(id) { return pub(byId.get(Number(id))); },
  create({ email, passwordHash, role = 'patient', firstName = '', lastName = '', phone = '', nationalId = '' }) {
    const info = insert.run({
      email: String(email).trim().toLowerCase(), passwordHash, role,
      firstName, lastName, phone, nationalId, createdAt: new Date().toISOString(),
    });
    return pub(byId.get(info.lastInsertRowid));
  },
  countAdmins() { return countAdmins.get().n; },
};
