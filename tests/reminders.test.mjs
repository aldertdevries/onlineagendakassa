import { test, assertEqual } from './framework.mjs';
import { appointmentsDueForReminder, invoicesDueForReminder, shiftDays } from '../js/logic/reminders.js';

test('shiftDays over maandgrens', () => {
  assertEqual(shiftDays('2026-07-31', 7), '2026-08-07');
});

test('afspraakherinnering binnen 24 uur, eenmalig', () => {
  const appts = [
    { id: 1, status: 'scheduled', reminderSentAt: null, startsAt: '2026-07-12T10:00' },
    { id: 2, status: 'scheduled', reminderSentAt: '2026-07-11T08:00', startsAt: '2026-07-12T10:00' },
    { id: 3, status: 'scheduled', reminderSentAt: null, startsAt: '2026-07-14T10:00' },
    { id: 4, status: 'cancelled', reminderSentAt: null, startsAt: '2026-07-12T10:00' },
  ];
  const due = appointmentsDueForReminder(appts, '2026-07-11T12:00');
  assertEqual(due.map(a => a.id), [1]);
});

test('betalingsherinnering op +7 en +14 dagen, max 2', () => {
  const inv = [
    { id: 1, status: 'sent', dueAt: '2026-07-01', reminderCount: 0 },
    { id: 2, status: 'sent', dueAt: '2026-07-01', reminderCount: 1 },
    { id: 3, status: 'sent', dueAt: '2026-07-01', reminderCount: 2 },
    { id: 4, status: 'sent', dueAt: '2026-07-08', reminderCount: 0 },
    { id: 5, status: 'paid', dueAt: '2026-07-01', reminderCount: 0 },
  ];
  assertEqual(invoicesDueForReminder(inv, '2026-07-11').map(i => i.id), [1]);
  assertEqual(invoicesDueForReminder(inv, '2026-07-15').map(i => i.id), [1, 2, 4]);
});
