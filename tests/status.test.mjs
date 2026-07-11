import { test, assertEqual, assertTrue } from './framework.mjs';
import { canTransition, STATUS_LABELS } from '../js/logic/status.js';

const appt = { startsAt: '2026-07-13T10:00', status: 'scheduled' };

test('bedrijf mag alle overgangen vanuit scheduled', () => {
  for (const to of ['cancelled', 'completed', 'no_show'])
    assertTrue(canTransition(appt, to, 'company', '2026-07-13T09:59', 24).ok, to + ':');
});

test('geen overgang vanuit eindstatus', () => {
  const done = { ...appt, status: 'completed' };
  assertEqual(canTransition(done, 'cancelled', 'company', '2026-07-01T00:00', 24).ok, false);
});

test('klant mag afzeggen buiten de termijn', () => {
  assertTrue(canTransition(appt, 'cancelled', 'customer', '2026-07-12T09:59', 24).ok);
});

test('klant mag niet afzeggen binnen de termijn', () => {
  const r = canTransition(appt, 'cancelled', 'customer', '2026-07-12T10:01', 24);
  assertEqual(r.ok, false);
});

test('klant mag nooit voltooien', () => {
  assertEqual(canTransition(appt, 'completed', 'customer', '2026-07-01T00:00', 24).ok, false);
});

test('labels compleet', () => {
  assertEqual(STATUS_LABELS.no_show, 'Niet op komen dagen');
});
