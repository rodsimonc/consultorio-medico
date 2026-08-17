// Computes a doctor's free time slots on a given date, from their availability
// minus already-booked appointments. Argentina = UTC-3 (fixed).
const AR_OFFSET_H = 3;

export function slotsFor({ ranges, dateYmd, takenSet, nowMs }) {
  const [Y, M, D] = dateYmd.split('-').map(Number);
  const dow = new Date(Date.UTC(Y, M - 1, D)).getUTCDay(); // 0=Sun..6=Sat
  const slots = [];
  for (const f of ranges.filter((r) => r.dayOfWeek === dow)) {
    const [hi, mi] = f.startTime.split(':').map(Number);
    const [hf, mf] = f.endTime.split(':').map(Number);
    let cur = hi * 60 + mi;
    const end = hf * 60 + mf;
    const dur = f.slotMinutes || 30;
    while (cur + dur <= end) {
      const h = Math.floor(cur / 60);
      const m = cur % 60;
      const utcMs = Date.UTC(Y, M - 1, D, h + AR_OFFSET_H, m);
      const iso = new Date(utcMs).toISOString();
      if (utcMs > nowMs && !takenSet.has(iso)) {
        slots.push({ dateTime: iso, time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, durationMin: dur });
      }
      cur += dur;
    }
  }
  return slots.sort((a, b) => (a.dateTime < b.dateTime ? -1 : 1));
}

// Formats an ISO UTC date to readable text in Argentina time.
export function formatAr(iso) {
  try {
    return new Date(iso).toLocaleString('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'full', timeStyle: 'short' });
  } catch { return iso; }
}
