import { test, assertEqual, assertTrue } from './framework.mjs';
import { createStore } from '../js/store.js';

function memStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: k => m.delete(k),
  };
}

test('create kent oplopende unieke ids toe', () => {
  const s = createStore(memStorage());
  const a = s.customers.create({ name: 'Jan' });
  const b = s.companies.create({ name: 'Salon X' });
  assertTrue(a.id !== b.id, 'ids uniek over collecties:');
});

test('data blijft bewaard in storage', () => {
  const mem = memStorage();
  const s1 = createStore(mem);
  s1.customers.create({ name: 'Jan' });
  const s2 = createStore(mem);
  assertEqual(s2.customers.all().length, 1);
});

test('update en where werken', () => {
  const s = createStore(memStorage());
  const c = s.customers.create({ name: 'Jan', city: 'Zwolle' });
  s.customers.update(c.id, { city: 'Kampen' });
  assertEqual(s.customers.where(x => x.city === 'Kampen').length, 1);
  assertEqual(s.customers.get(c.id).city, 'Kampen');
});

test('remove en reset', () => {
  const s = createStore(memStorage());
  const c = s.customers.create({ name: 'Jan' });
  s.customers.remove(c.id);
  assertEqual(s.customers.all(), []);
  s.companies.create({ name: 'X' });
  s.reset();
  assertEqual(s.companies.all(), []);
});

test('store heeft een accessCodes-collectie', () => {
  const s = createStore(memStorage());
  const rec = s.accessCodes.create({ companyId: 1, customerId: 2, channel: 'sms', code: '123456', expiresAt: '2026-07-12T10:10', attempts: 0 });
  assertEqual(s.accessCodes.get(rec.id).code, '123456', 'aanmaken/ophalen:');
});
