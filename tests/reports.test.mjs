import { test, assertEqual } from './framework.mjs';
import { periodKey, revenueByPeriod, paymentStatusOfAppointment, inactiveCustomers } from '../js/logic/reports.js';

test('periodKey alle periodes', () => {
  assertEqual(periodKey('2026-07-11T10:00', 'day'), '2026-07-11');
  assertEqual(periodKey('2026-07-11T10:00', 'week'), '2026-W28');
  assertEqual(periodKey('2026-07-11T10:00', 'month'), '2026-07');
  assertEqual(periodKey('2026-07-11T10:00', 'quarter'), '2026-Q3');
  assertEqual(periodKey('2026-07-11T10:00', 'year'), '2026');
});

test('ISO-week over jaargrens', () => {
  assertEqual(periodKey('2026-01-01', 'week'), '2026-W01');
  assertEqual(periodKey('2027-01-01', 'week'), '2026-W53');
});

test('revenueByPeriod telt alleen paid, creditnota negatief', () => {
  const inv = [
    { status: 'paid', paidAt: '2026-07-05T10:00', totals: { inclCents: 4235 } },
    { status: 'paid', paidAt: '2026-07-06T10:00', totals: { inclCents: -4235 } },
    { status: 'sent', paidAt: null, totals: { inclCents: 9999 } },
  ];
  assertEqual(revenueByPeriod(inv, 'month'), { '2026-07': 0 });
});

test('paymentStatusOfAppointment', () => {
  const a = { id: 5 };
  assertEqual(paymentStatusOfAppointment(a, []), 'geen_factuur');
  assertEqual(paymentStatusOfAppointment(a, [{ appointmentId: 5, status: 'sent' }]), 'openstaand');
  assertEqual(paymentStatusOfAppointment(a, [{ appointmentId: 5, status: 'paid' }]), 'betaald');
  assertEqual(paymentStatusOfAppointment(a, [{ appointmentId: 5, status: 'cancelled' }]), 'geen_factuur');
});

test('inactiveCustomers X-Y dagen', () => {
  const klanten = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
  const appts = [
    { customerId: 1, startsAt: '2026-06-21T10:00' },
    { customerId: 2, startsAt: '2026-07-09T10:00' },
  ];
  const r = inactiveCustomers(appts, klanten, 10, 30, '2026-07-11');
  assertEqual(r.map(x => x.customer.id), [1]);
  assertEqual(r[0].lastAppointmentAt, '2026-06-21T10:00');
});
