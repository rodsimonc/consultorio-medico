// Seed idempotente: admin opcional (por env) + especialidades, médicos y agendas de ejemplo.
import { config } from '../config.js';
import { usersRepo } from '../repositories/users.repo.js';
import { catalogRepo } from '../repositories/catalog.repo.js';
import { hashPassword } from '../services/password.js';

export function runSeed({ verbose = false } = {}) {
  const log = (...a) => verbose && console.log('[seed]', ...a);

  if (usersRepo.countAdmins() === 0) {
    if (config.admin.email && config.admin.password) {
      usersRepo.create({ email: config.admin.email, passwordHash: hashPassword(config.admin.password), role: 'admin', nombre: 'Recepción' });
      log(`admin creado desde env: ${config.admin.email}`);
    } else {
      log('sin admin: creá la cuenta de recepción en /admin.html (primer uso).');
    }
  }

  if (config.seedSampleData && catalogRepo.countEspecialidades() === 0) {
    const esps = {};
    for (const n of ['Clínica médica', 'Cardiología', 'Pediatría', 'Dermatología']) {
      esps[n] = catalogRepo.createEspecialidad({ nombre: n });
    }
    const medicos = [
      { nombre: 'Laura', apellido: 'Gómez', esp: 'Clínica médica' },
      { nombre: 'Martín', apellido: 'Pereyra', esp: 'Cardiología' },
      { nombre: 'Sofía', apellido: 'Díaz', esp: 'Pediatría' },
      { nombre: 'Julián', apellido: 'Fernández', esp: 'Dermatología' },
    ];
    for (const m of medicos) {
      const med = catalogRepo.createMedico({ nombre: m.nombre, apellido: m.apellido, especialidadId: esps[m.esp].id, matricula: 'MP-' + Math.floor(1000 + Math.random() * 8999) });
      // Agenda: lunes a viernes (1..5), 09:00–13:00, turnos de 30 min.
      const franjas = [1, 2, 3, 4, 5].map((d) => ({ diaSemana: d, horaInicio: '09:00', horaFin: '13:00', duracionMin: 30 }));
      catalogRepo.setDisponibilidad(med.id, franjas);
    }
    log(`${medicos.length} médicos y sus agendas creados`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed({ verbose: true });
  console.log('Seed completado.');
}
