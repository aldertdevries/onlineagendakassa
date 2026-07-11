export const STATUS_LABELS = {
  scheduled: 'Gemaakt',
  cancelled: 'Afgezegd',
  completed: 'Voltooid',
  no_show: 'Niet op komen dagen',
};

export function canTransition(appointment, to, actor, now, cancelHours) {
  if (appointment.status !== 'scheduled')
    return { ok: false, reason: 'Alleen een gemaakte afspraak kan van status wisselen.' };
  if (actor === 'company') {
    if (['cancelled', 'completed', 'no_show'].includes(to)) return { ok: true };
    return { ok: false, reason: 'Ongeldige status.' };
  }
  if (to !== 'cancelled')
    return { ok: false, reason: 'Als klant kun je alleen afzeggen.' };
  const deadline = new Date(appointment.startsAt);
  deadline.setHours(deadline.getHours() - cancelHours);
  if (new Date(now) >= deadline)
    return { ok: false, reason: `Afzeggen kan tot ${cancelHours} uur van tevoren.` };
  return { ok: true };
}
