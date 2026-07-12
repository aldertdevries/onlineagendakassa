export function seedIfEmpty(store, todayStr) {
  if (store.companies.all().length > 0) return;
  const day = offset => shiftDate(todayStr, offset);
  const at = (offset, time) => `${day(offset)}T${time}`;

  const salon = store.companies.create({
    name: 'Salon Zonnig', publicId: 'k7f3q9w2', street: 'Hoofdstraat', houseNumber: '12',
    postalCode: '8011 AA', city: 'Zwolle', phone: '+31612345678',
    email: 'info@salonzonnig.nl', kvk: '12345678', logoDataUrl: null,
    emailVerified: true, phoneVerified: true, approvedAt: at(-30, '10:00'),
    rejectedReason: null, mollieLinked: true, cancelHours: 24,
  });
  const fysio = store.companies.create({
    name: 'Fysio Vitaal', publicId: 'p2m8x4r6', street: 'Stationsweg', houseNumber: '8',
    postalCode: '8021 CD', city: 'Zwolle', phone: '+31623456789',
    email: 'praktijk@fysiovitaal.nl', kvk: '23456789', logoDataUrl: null,
    emailVerified: true, phoneVerified: true, approvedAt: at(-20, '14:00'),
    rejectedReason: null, mollieLinked: false, cancelHours: 48,
  });
  store.companies.create({
    name: 'Kapper Nieuw', publicId: 'h9t5w3n7', street: 'Marktplein', houseNumber: '1',
    postalCode: '8011 EF', city: 'Zwolle', phone: '+31634567890',
    email: 'hallo@kappernieuw.nl', kvk: '34567890', logoDataUrl: null,
    emailVerified: true, phoneVerified: true, approvedAt: null,
    rejectedReason: null, mollieLinked: false, cancelHours: 24,
  });

  const annaSalon = store.customers.create({
    name: 'Anna Jansen', companyId: salon.id, street: 'Kerkweg', houseNumber: '3',
    postalCode: '8022 BB', city: 'Zwolle', phone: '+31687654321', email: 'anna@example.com',
  });
  const bramSalon = store.customers.create({
    name: 'Bram de Boer', companyId: salon.id, street: 'Molenstraat', houseNumber: '22',
    postalCode: '8023 GH', city: 'Zwolle', phone: '+31676543210', email: 'bram@example.com',
  });
  store.customers.create({
    name: 'Carla Visser', companyId: salon.id, street: 'Dijkweg', houseNumber: '7',
    postalCode: '8024 JK', city: 'Zwolle', phone: '+31665432109', email: 'carla@example.com',
  });
  const annaFysio = store.customers.create({
    name: 'Anna Jansen', companyId: fysio.id, street: 'Kerkweg', houseNumber: '3',
    postalCode: '8022 BB', city: 'Zwolle', phone: '+31687654321', email: 'anna@example.com',
  });
  const bramFysio = store.customers.create({
    name: 'Bram de Boer', companyId: fysio.id, street: 'Molenstraat', houseNumber: '22',
    postalCode: '8023 GH', city: 'Zwolle', phone: '+31676543210', email: 'bram@example.com',
  });

  const stoel1 = store.calendars.create({ companyId: salon.id, name: 'Stoel 1', slotMinutes: 30, active: true });
  store.calendars.create({ companyId: salon.id, name: 'Stoel 2', slotMinutes: 60, active: true });
  const kamer1 = store.calendars.create({ companyId: fysio.id, name: 'Behandelkamer 1', slotMinutes: 30, active: true });
  store.calendars.create({ companyId: fysio.id, name: 'Behandelkamer 2', slotMinutes: 60, active: true });

  for (const cal of store.calendars.all())
    for (const wd of [1, 2, 3, 4, 5])
      store.openingHours.create({ calendarId: cal.id, weekday: wd, start: '09:00', end: '17:00' });

  store.blocks.create({ calendarId: stoel1.id, from: at(7, '00:00'), to: at(8, '23:59'), reason: 'Vakantie' });

  const done = store.appointments.create({
    calendarId: stoel1.id, customerId: annaSalon.id,
    startsAt: at(-7, '10:00'), endsAt: at(-7, '10:30'), status: 'completed',
    reminderSentAt: null, cancelledAt: null, completedAt: at(-7, '11:00'), noShowAt: null,
  });
  const doneBram = store.appointments.create({
    calendarId: kamer1.id, customerId: bramFysio.id,
    startsAt: at(-14, '14:00'), endsAt: at(-14, '14:30'), status: 'completed',
    reminderSentAt: null, cancelledAt: null, completedAt: at(-14, '15:00'), noShowAt: null,
  });
  store.appointments.create({
    calendarId: stoel1.id, customerId: bramSalon.id,
    startsAt: at(-3, '11:00'), endsAt: at(-3, '11:30'), status: 'no_show',
    reminderSentAt: null, cancelledAt: null, completedAt: null, noShowAt: at(-3, '12:00'),
  });
  store.appointments.create({
    calendarId: kamer1.id, customerId: annaFysio.id,
    startsAt: at(-1, '09:00'), endsAt: at(-1, '09:30'), status: 'cancelled',
    reminderSentAt: null, cancelledAt: at(-2, '18:00'), completedAt: null, noShowAt: null,
  });
  store.appointments.create({
    calendarId: stoel1.id, customerId: annaSalon.id,
    startsAt: at(2, '13:00'), endsAt: at(2, '13:30'), status: 'scheduled',
    reminderSentAt: null, cancelledAt: null, completedAt: null, noShowAt: null,
  });
  store.appointments.create({
    calendarId: kamer1.id, customerId: bramFysio.id,
    startsAt: at(1, '10:00'), endsAt: at(1, '10:30'), status: 'scheduled',
    reminderSentAt: null, cancelledAt: null, completedAt: null, noShowAt: null,
  });

  store.invoices.create({
    issuerCompanyId: salon.id, recipientType: 'customer', recipientId: annaSalon.id,
    appointmentId: done.id, number: '2026-0001', status: 'paid',
    issuedAt: at(-7, '12:00'), dueAt: day(7), paidAt: at(-5, '09:12'),
    creditedInvoiceId: null, reminderCount: 0, lastReminderAt: null,
    lines: [{ description: 'Knipbeurt', qty: 1, unitPriceCents: 3500, vatRate: 21 }],
    totals: { exclCents: 3500, vatCents: 735, inclCents: 4235, vatByRate: { 21: 735 } },
  });
  store.invoices.create({
    issuerCompanyId: fysio.id, recipientType: 'customer', recipientId: bramFysio.id,
    appointmentId: doneBram.id, number: '2026-0001', status: 'sent',
    issuedAt: at(-24, '16:00'), dueAt: day(-10), paidAt: null,
    creditedInvoiceId: null, reminderCount: 0, lastReminderAt: null,
    lines: [{ description: 'Fysiobehandeling', qty: 1, unitPriceCents: 4500, vatRate: 9 }],
    totals: { exclCents: 4500, vatCents: 405, inclCents: 4905, vatByRate: { 9: 405 } },
  });
  store.invoices.create({
    issuerCompanyId: salon.id, recipientType: 'customer', recipientId: bramSalon.id,
    appointmentId: null, number: null, status: 'draft',
    issuedAt: null, dueAt: null, paidAt: null,
    creditedInvoiceId: null, reminderCount: 0, lastReminderAt: null,
    lines: [{ description: 'Verzorgingsproducten', qty: 2, unitPriceCents: 1250, vatRate: 21 }],
    totals: null,
  });
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00');
  d.setDate(d.getDate() + days);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
