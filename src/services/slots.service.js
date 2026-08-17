// Calcula los horarios libres de un médico en una fecha, a partir de su
// disponibilidad menos los turnos ya tomados. Argentina = UTC-3 (fijo).
const AR_OFFSET_H = 3;

export function slotsFor({ franjas, dateYmd, takenSet, nowMs }) {
  const [Y, M, D] = dateYmd.split('-').map(Number);
  const dow = new Date(Date.UTC(Y, M - 1, D)).getUTCDay(); // 0=Dom..6=Sáb
  const slots = [];
  for (const f of franjas.filter((fr) => fr.diaSemana === dow)) {
    const [hi, mi] = f.horaInicio.split(':').map(Number);
    const [hf, mf] = f.horaFin.split(':').map(Number);
    let cur = hi * 60 + mi;
    const end = hf * 60 + mf;
    const dur = f.duracionMin || 30;
    while (cur + dur <= end) {
      const h = Math.floor(cur / 60);
      const m = cur % 60;
      const utcMs = Date.UTC(Y, M - 1, D, h + AR_OFFSET_H, m);
      const iso = new Date(utcMs).toISOString();
      if (utcMs > nowMs && !takenSet.has(iso)) {
        slots.push({ fechaHora: iso, hora: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, duracionMin: dur });
      }
      cur += dur;
    }
  }
  return slots.sort((a, b) => (a.fechaHora < b.fechaHora ? -1 : 1));
}

// Formatea una fecha ISO UTC a texto legible en horario argentino.
export function formatAr(iso) {
  try {
    return new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'full', timeStyle: 'short' });
  } catch { return iso; }
}
