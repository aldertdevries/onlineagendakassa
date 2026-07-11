import { test, assertEqual } from './framework.mjs';
import { slotsForDay, addMinutes } from '../js/logic/slots.js';

const hours = [{ calendarId: 1, weekday: 1, start: '09:00', end: '11:00' }]; // maandag
const MA = '2026-07-13'; // een maandag

test('addMinutes telt over uurgrens', () => {
  assertEqual(addMinutes('2026-07-13T10:45', 30), '2026-07-13T11:15');
});

test('genereert sloten binnen openingstijd', () => {
  const s = slotsForDay({ dateStr: MA, openingHours: hours, slotMinutes: 30,
    appointments: [], blocks: [], now: '2026-07-01T00:00' });
  assertEqual(s.length, 4);
  assertEqual(s[0], { startsAt: '2026-07-13T09:00', endsAt: '2026-07-13T09:30', free: true });
});

test('bezet slot is niet vrij, cancelled telt niet', () => {
  const appts = [
    { startsAt: '2026-07-13T09:00', status: 'scheduled' },
    { startsAt: '2026-07-13T09:30', status: 'cancelled' },
  ];
  const s = slotsForDay({ dateStr: MA, openingHours: hours, slotMinutes: 30,
    appointments: appts, blocks: [], now: '2026-07-01T00:00' });
  assertEqual(s[0].free, false);
  assertEqual(s[1].free, true);
});

test('blokkade maakt overlappende sloten onvrij', () => {
  const blocks = [{ from: '2026-07-13T09:15', to: '2026-07-13T10:15', reason: 'x' }];
  const s = slotsForDay({ dateStr: MA, openingHours: hours, slotMinutes: 30,
    appointments: [], blocks, now: '2026-07-01T00:00' });
  assertEqual(s.map(x => x.free), [false, false, false, true]);
});

test('verleden sloten worden weggelaten', () => {
  const s = slotsForDay({ dateStr: MA, openingHours: hours, slotMinutes: 30,
    appointments: [], blocks: [], now: '2026-07-13T09:30' });
  assertEqual(s.length, 3, 'slot 09:00 (eind 09:30) valt af:');
});

test('dag zonder openingstijden geeft lege lijst', () => {
  const s = slotsForDay({ dateStr: '2026-07-12', openingHours: hours, slotMinutes: 30,
    appointments: [], blocks: [], now: '2026-07-01T00:00' }); // zondag
  assertEqual(s, []);
});
