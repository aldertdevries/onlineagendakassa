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
