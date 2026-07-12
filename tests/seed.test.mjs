import { test, assertEqual, assertTrue } from './framework.mjs';
import { createStore } from '../js/store.js';
import { seedIfEmpty } from '../js/seed.js';

function memStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: k => m.delete(k),
  };
}

test('seed vult lege store en is idempotent', () => {
  const s = createStore(memStorage());
  seedIfEmpty(s, '2026-07-11');
  const n = s.companies.all().length;
  assertEqual(n, 3, 'bedrijven:');
  seedIfEmpty(s, '2026-07-11');
  assertEqual(s.companies.all().length, n, 'idempotent:');
});

test('seed bevat alle afspraakstatussen en factuurstatussen', () => {
  const s = createStore(memStorage());
  seedIfEmpty(s, '2026-07-11');
  const st = new Set(s.appointments.all().map(a => a.status));
  for (const x of ['scheduled', 'cancelled', 'completed', 'no_show'])
    assertTrue(st.has(x), `afspraakstatus ${x}:`);
  const inv = new Set(s.invoices.all().map(i => i.status));
  for (const x of ['draft', 'sent', 'paid']) assertTrue(inv.has(x), `factuurstatus ${x}:`);
});

test('seed bevat keuringswachtrij en vervallen factuur', () => {
  const s = createStore(memStorage());
  seedIfEmpty(s, '2026-07-11');
  assertEqual(s.companies.where(c => !c.approvedAt).length, 1, 'wachtrij:');
  assertTrue(
    s.invoices.where(i => i.status === 'sent' && i.dueAt < '2026-07-11').length >= 1,
    'vervallen factuur:'
  );
});

test('seed: bedrijven hebben een uniek publiek ID', () => {
  const s = createStore(memStorage());
  seedIfEmpty(s, '2026-07-11');
  const ids = s.companies.all().map(c => c.publicId);
  assertTrue(ids.every(id => typeof id === 'string' && id.length === 8), 'vorm:');
  assertEqual(new Set(ids).size, ids.length, 'uniek:');
});

test('seed: klanten horen bij één bedrijf en afspraken blijven binnen dat bedrijf', () => {
  const s = createStore(memStorage());
  seedIfEmpty(s, '2026-07-11');
  assertTrue(s.customers.all().every(c => typeof c.companyId === 'number'), 'companyId:');
  for (const a of s.appointments.all()) {
    const cal = s.calendars.get(a.calendarId);
    const klant = s.customers.get(a.customerId);
    assertEqual(klant.companyId, cal.companyId, `afspraak ${a.id}:`);
  }
  for (const i of s.invoices.all().filter(i => i.recipientType === 'customer')) {
    assertEqual(s.customers.get(i.recipientId).companyId, i.issuerCompanyId, `factuur ${i.id}:`);
  }
});
