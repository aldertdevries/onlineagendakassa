import { addMinutes } from './slots.js';

export function shiftDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00');
  d.setDate(d.getDate() + days);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function appointmentsDueForReminder(appointments, now) {
  const limit = addMinutes(now, 24 * 60);
  return appointments.filter(a =>
    a.status === 'scheduled' && !a.reminderSentAt && a.startsAt > now && a.startsAt <= limit
  );
}

export function invoicesDueForReminder(invoices, todayStr) {
  return invoices.filter(i => {
    if (i.status !== 'sent') return false;
    if (i.reminderCount === 0) return todayStr >= shiftDays(i.dueAt, 7);
    if (i.reminderCount === 1) return todayStr >= shiftDays(i.dueAt, 14);
    return false;
  });
}
