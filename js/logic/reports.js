export function periodKey(dt, period) {
  const [y, m, d] = dt.slice(0, 10).split('-').map(Number);
  if (period === 'day') return dt.slice(0, 10);
  if (period === 'month') return dt.slice(0, 7);
  if (period === 'year') return String(y);
  if (period === 'quarter') return `${y}-Q${Math.ceil(m / 3)}`;
  // ISO-week: donderdag van de week bepaalt het jaar
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function revenueByPeriod(invoices, period) {
  const out = {};
  for (const i of invoices.filter(x => x.status === 'paid')) {
    const k = periodKey(i.paidAt, period);
    out[k] = (out[k] || 0) + i.totals.inclCents;
  }
  return out;
}

export function paymentStatusOfAppointment(appointment, invoices) {
  const inv = invoices.find(i => i.appointmentId === appointment.id && i.status !== 'cancelled');
  if (!inv) return 'geen_factuur';
  return inv.status === 'paid' ? 'betaald' : 'openstaand';
}

export function inactiveCustomers(appointments, customers, minDays, maxDays, todayStr) {
  const today = new Date(todayStr + 'T12:00');
  const out = [];
  for (const c of customers) {
    const own = appointments.filter(a => a.customerId === c.id).map(a => a.startsAt).sort();
    if (!own.length) continue;
    const last = own[own.length - 1];
    const days = Math.floor((today - new Date(last)) / 86400000);
    if (days >= minDays && days <= maxDays) out.push({ customer: c, lastAppointmentAt: last });
  }
  return out;
}
