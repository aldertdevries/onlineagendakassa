export function addMinutes(dt, min) {
  const d = new Date(dt);
  d.setMinutes(d.getMinutes() + min);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function slotsForDay({ dateStr, openingHours, slotMinutes, appointments, blocks, now }) {
  const weekday = new Date(dateStr + 'T12:00').getDay();
  const slots = [];
  for (const oh of openingHours.filter(h => h.weekday === weekday)) {
    let t = `${dateStr}T${oh.start}`;
    const end = `${dateStr}T${oh.end}`;
    while (addMinutes(t, slotMinutes) <= end) {
      const startsAt = t;
      const endsAt = addMinutes(t, slotMinutes);
      if (endsAt > now) {
        const taken = appointments.some(a => a.status !== 'cancelled' && a.startsAt === startsAt);
        const blocked = blocks.some(b => b.from < endsAt && b.to > startsAt);
        slots.push({ startsAt, endsAt, free: !taken && !blocked });
      }
      t = endsAt;
    }
  }
  return slots.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
}
