// Idempotent seed: optional admin (from env) + sample specialties, doctors and schedules.
import { config } from '../config.js';
import { usersRepo } from '../repositories/users.repo.js';
import { catalogRepo } from '../repositories/catalog.repo.js';
import { hashPassword } from '../services/password.js';

export function runSeed({ verbose = false } = {}) {
  const log = (...a) => verbose && console.log('[seed]', ...a);

  if (usersRepo.countAdmins() === 0) {
    if (config.admin.email && config.admin.password) {
      usersRepo.create({ email: config.admin.email, passwordHash: hashPassword(config.admin.password), role: 'admin', firstName: 'Front desk' });
      log(`admin created from env: ${config.admin.email}`);
    } else {
      log('no admin yet: create the front-desk account at /admin.html (first use).');
    }
  }

  if (config.seedSampleData && catalogRepo.countSpecialties() === 0) {
    const specs = {};
    for (const n of ['General medicine', 'Cardiology', 'Pediatrics', 'Dermatology']) {
      specs[n] = catalogRepo.createSpecialty({ name: n });
    }
    const doctors = [
      { firstName: 'Laura', lastName: 'Gomez', spec: 'General medicine' },
      { firstName: 'Martin', lastName: 'Pereyra', spec: 'Cardiology' },
      { firstName: 'Sofia', lastName: 'Diaz', spec: 'Pediatrics' },
      { firstName: 'Julian', lastName: 'Fernandez', spec: 'Dermatology' },
    ];
    for (const m of doctors) {
      const doc = catalogRepo.createDoctor({ firstName: m.firstName, lastName: m.lastName, specialtyId: specs[m.spec].id, license: 'LIC-' + Math.floor(1000 + Math.random() * 8999) });
      // Schedule: Monday to Friday (1..5), 09:00–13:00, 30-min slots.
      const ranges = [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '13:00', slotMinutes: 30 }));
      catalogRepo.setAvailability(doc.id, ranges);
    }
    log(`${doctors.length} doctors and their schedules created`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed({ verbose: true });
  console.log('Seed complete.');
}
