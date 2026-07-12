import { test, assertEqual, assertTrue } from './framework.mjs';
import {
  normalizePhone, validateKlantGegevens, findCustomer,
  makePublicId, checkAccessCode, CODE_MAX_POGINGEN,
} from '../js/logic/klant-toegang.js';

test('normalizePhone accepteert +31 en 06 en normaliseert', () => {
  assertEqual(normalizePhone('+31612345678'), '+31612345678', '+31:');
  assertEqual(normalizePhone('0612345678'), '+31612345678', '06:');
  assertEqual(normalizePhone('06 12 34 56 78'), '+31612345678', 'spaties:');
  assertEqual(normalizePhone('06-12345678'), '+31612345678', 'streepjes:');
  assertEqual(normalizePhone('12345'), null, 'te kort:');
  assertEqual(normalizePhone('+32475123456'), null, 'buitenlands:');
  assertEqual(normalizePhone(''), null, 'leeg:');
});

test('validateKlantGegevens keurt geldige invoer goed', () => {
  const r = validateKlantGegevens({ name: 'Anna', email: 'a@b.nl', phone: '0612345678' });
  assertTrue(r.ok, 'geldig:');
  assertEqual(r.errors, {}, 'geen fouten:');
});

test('validateKlantGegevens meldt fouten per veld', () => {
  const r = validateKlantGegevens({ name: ' ', email: 'geen-mail', phone: '123' });
  assertTrue(!r.ok, 'ongeldig:');
  assertTrue(!!r.errors.name, 'naamfout:');
  assertTrue(!!r.errors.email, 'mailfout:');
  assertTrue(!!r.errors.phone, 'telefoonfout:');
});

const klanten = [
  { id: 1, companyId: 10, email: 'anna@example.com', phone: '+31687654321' },
  { id: 2, companyId: 20, email: 'anna@example.com', phone: '+31687654321' },
  { id: 3, companyId: 10, email: 'bram@example.com', phone: '+31676543210' },
];

test('findCustomer matcht op e-mail binnen het bedrijf', () => {
  assertEqual(findCustomer(klanten, 10, 'ANNA@example.com', '').id, 1, 'case-insensitief:');
  assertEqual(findCustomer(klanten, 20, 'anna@example.com', '').id, 2, 'ander bedrijf, eigen record:');
  assertEqual(findCustomer(klanten, 10, 'onbekend@example.com', ''), null, 'onbekend:');
});

test('findCustomer matcht op genormaliseerd telefoonnummer', () => {
  assertEqual(findCustomer(klanten, 10, '', '06 87 65 43 21').id, 1, '06-notatie:');
  assertEqual(findCustomer(klanten, 10, '', ''), null, 'beide leeg:');
});

test('makePublicId maakt 8 tekens uit het veilige alfabet', () => {
  const id = makePublicId(() => 0.5);
  assertEqual(id.length, 8, 'lengte:');
  assertTrue(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/.test(id), 'alfabet:');
  assertEqual(makePublicId(() => 0), 'aaaaaaaa', 'deterministisch:');
});

test('checkAccessCode: juiste code binnen de tijd is ok', () => {
  const rec = { code: '123456', expiresAt: '2026-07-12T10:10', attempts: 0 };
  assertTrue(checkAccessCode(rec, '123456', '2026-07-12T10:05').ok, 'juist:');
  assertTrue(checkAccessCode(rec, ' 123456 ', '2026-07-12T10:05').ok, 'met spaties:');
});

test('checkAccessCode: verlopen, fout en pogingenlimiet', () => {
  const rec = { code: '123456', expiresAt: '2026-07-12T10:10', attempts: 0 };
  const verlopen = checkAccessCode(rec, '123456', '2026-07-12T10:11');
  assertTrue(!verlopen.ok && !verlopen.telPoging, 'verlopen telt geen poging:');
  const fout = checkAccessCode(rec, '000000', '2026-07-12T10:05');
  assertTrue(!fout.ok && fout.telPoging === true, 'fout telt als poging:');
  const op = checkAccessCode({ ...rec, attempts: CODE_MAX_POGINGEN }, '123456', '2026-07-12T10:05');
  assertTrue(!op.ok && !op.telPoging, 'limiet bereikt:');
  assertTrue(!checkAccessCode(null, '123456', '2026-07-12T10:05').ok, 'geen record:');
});
