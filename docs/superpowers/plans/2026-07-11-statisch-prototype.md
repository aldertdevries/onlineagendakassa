# Statisch Prototype (GitHub Pages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een klikbaar statisch prototype (HTML/CSS/vanilla JS + localStorage) van de afspraken- en kassa-applicatie, publiek testbaar via GitHub Pages, met gesimuleerde e-mail/SMS/Mollie.

**Architecture:** Drie portaalpagina's (klant, bedrijf, admin) plus een nep-Mollie-betaalpagina delen één localStorage-datalaag (`store.js`) en pure rekenmodules (`js/logic/*.js`). Alle externe diensten zijn zichtbare simulaties: een postvak-paneel voor e-mail, SMS-codes op het scherm, een nep-betaalpagina. De rekenlogica is puur en wordt getest via een Node-testrunner én een browserpagina (`tests.html`).

**Tech Stack:** HTML5, CSS (één stylesheet, geen framework), vanilla JavaScript ES-modules, localStorage. Geen buildstap, geen dependencies. Node (elke recente versie) alleen om tests te draaien.

## Global Constraints

- Geen buildstap, geen npm-dependencies: de repo-root is direct als GitHub Pages te publiceren.
- Alle bedragen zijn integers in **centen**; BTW-tarieven zijn 21, 9 of 0 (procent).
- Alle tijdstippen zijn lokale-tijd-strings in het formaat `YYYY-MM-DDTHH:mm` (lexicografisch vergelijkbaar); datums als `YYYY-MM-DD`. Geen timezone-logica in het prototype.
- Pure logica (alles onder `js/logic/`) heeft **geen** DOM-, store- of `Date.now()`-toegang: "nu" wordt altijd als parameter meegegeven.
- Afspraakstatussen: `scheduled` | `cancelled` | `completed` | `no_show`. Factuurstatussen: `draft` | `sent` | `paid` | `cancelled`.
- UI-teksten in het Nederlands.
- Elke taak eindigt met draaiende tests (`node tests/run.mjs`) en een commit.
- Max 4 agenda's per bedrijf; standaard afzegtermijn 24 uur (per bedrijf instelbaar).
- localStorage-sleutel voor alle data: `akp-data`.

## Bestandsstructuur

```
index.html            klantportaal (+ publieke bedrijvenlijst, registratie, boeken)
bedrijf.html          bedrijfsportaal
admin.html            adminportaal
betaal.html           nep-Mollie-betaalpagina
tests.html            browser-testrunner (zelfde tests als Node)
css/style.css         gedeelde stylesheet
js/store.js           localStorage-datalaag (CRUD + reset + seed-aanroep)
js/seed.js            demo-data
js/logic/slots.js     slotgenerator (puur)
js/logic/invoices.js  factuurtotalen, nummering, creditnota (puur)
js/logic/status.js    statusovergangen + afzegtermijn (puur)
js/logic/reminders.js afspraak- en betalingsherinneringen (puur)
js/logic/reports.js   omzet, betaalstatus, inactieve klanten (puur)
js/ui.js              gedeelde UI-helpers (formatting, postvak-paneel, gebruikerskiezer)
js/app-klant.js       logica klantportaal
js/app-bedrijf.js     logica bedrijfsportaal
js/app-admin.js       logica adminportaal
js/app-betaal.js      logica nep-Mollie-pagina
tests/framework.mjs   mini-testframework (test/assertEqual)
tests/run.mjs         Node-runner die alle testbestanden importeert
tests/*.test.mjs      één testbestand per logic-module + store
README.md             uitleg + GitHub Pages-instructies
.nojekyll             voorkomt Jekyll-verwerking op Pages
```

---

### Task 1: Projectskelet en testframework

**Files:**
- Create: `tests/framework.mjs`, `tests/run.mjs`, `tests/framework.test.mjs`, `.nojekyll`, `README.md`

**Interfaces:**
- Produces: `test(name, fn)`, `assertEqual(actual, expected, msg?)`, `assertTrue(value, msg?)` uit `tests/framework.mjs`; `runAll()` die `{passed, failed}` retourneert en per falende test naam + fout logt. Alle latere testbestanden importeren dit framework en worden geregistreerd in `tests/run.mjs`.

- [ ] **Step 1: Schrijf het testframework**

`tests/framework.mjs`:

```js
const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg} verwacht ${e}, kreeg ${a}`);
}

export function assertTrue(value, msg = '') {
  if (!value) throw new Error(`${msg} verwacht true, kreeg ${JSON.stringify(value)}`);
}

export function runAll(log = console.log) {
  let passed = 0;
  const failures = [];
  for (const t of tests) {
    try {
      t.fn();
      passed++;
    } catch (err) {
      failures.push({ name: t.name, error: err.message });
    }
  }
  for (const f of failures) log(`FAIL ${f.name}: ${f.error}`);
  log(`${passed} geslaagd, ${failures.length} gefaald`);
  return { passed, failed: failures.length };
}
```

- [ ] **Step 2: Schrijf een zelftest van het framework**

`tests/framework.test.mjs`:

```js
import { test, assertEqual, assertTrue } from './framework.mjs';

test('assertEqual vergelijkt via JSON', () => {
  assertEqual({ a: 1 }, { a: 1 });
});

test('assertTrue accepteert truthy', () => {
  assertTrue(1 === 1);
});
```

- [ ] **Step 3: Schrijf de runner**

`tests/run.mjs`:

```js
import './framework.test.mjs';
import { runAll } from './framework.mjs';

const { failed } = runAll();
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 4: Draai de tests**

Run: `node tests/run.mjs`
Expected: `2 geslaagd, 0 gefaald`, exitcode 0.

- [ ] **Step 5: Maak `.nojekyll` (leeg bestand) en `README.md`**

`README.md`:

```markdown
# Afspraken & Kassa — statisch prototype

Klikbaar prototype van de afspraken- en kassa-applicatie. Puur statisch
(HTML/JS/localStorage); e-mail, SMS en Mollie zijn zichtbare simulaties.

## Lokaal bekijken
Open `index.html` (klant), `bedrijf.html` of `admin.html` in de browser,
of serveer de map: `python -m http.server` en ga naar http://localhost:8000

## Tests
- Node: `node tests/run.mjs`
- Browser: open `tests.html`

## Publiceren op GitHub Pages
Settings → Pages → Source: `main`, map `/ (root)`.
```

- [ ] **Step 6: Commit**

```bash
git add tests .nojekyll README.md
git commit -m "feat: testframework en projectskelet"
```

---

### Task 2: localStorage-datalaag (store.js)

**Files:**
- Create: `js/store.js`
- Test: `tests/store.test.mjs`
- Modify: `tests/run.mjs` (import toevoegen)

**Interfaces:**
- Produces: `createStore(storage)` uit `js/store.js`. `storage` is een object met `getItem/setItem/removeItem` (localStorage in de browser, een in-memory stub in tests). De store heeft per collectie (`companies`, `customers`, `calendars`, `openingHours`, `blocks`, `appointments`, `invoices`, `mails`) de methodes:
  - `all()` → array
  - `get(id)` → object of `undefined`
  - `where(predicaat)` → array
  - `create(obj)` → object mét toegekend `id` (oplopend integer, uniek over de hele store)
  - `update(id, patch)` → bijgewerkt object
  - `remove(id)`
  - Daarnaast: `store.reset()` (leegt alles), `store.raw()` (het hele datablok, voor seed/debug). Elke mutatie schrijft direct naar `storage` onder sleutel `akp-data`.

- [ ] **Step 1: Schrijf failing tests**

`tests/store.test.mjs`:

```js
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
```

Voeg in `tests/run.mjs` vóór de `runAll`-import toe: `import './store.test.mjs';`

- [ ] **Step 2: Draai tests, verwacht falen**

Run: `node tests/run.mjs`
Expected: FAIL (module `../js/store.js` bestaat niet).

- [ ] **Step 3: Implementeer de store**

`js/store.js`:

```js
const KEY = 'akp-data';
const COLLECTIONS = [
  'companies', 'customers', 'calendars', 'openingHours',
  'blocks', 'appointments', 'invoices', 'mails',
];

function emptyData() {
  const d = { nextId: 1 };
  for (const c of COLLECTIONS) d[c] = [];
  return d;
}

export function createStore(storage) {
  let data;
  const rawStr = storage.getItem(KEY);
  data = rawStr ? JSON.parse(rawStr) : emptyData();

  function save() {
    storage.setItem(KEY, JSON.stringify(data));
  }

  const store = {
    reset() {
      data = emptyData();
      save();
    },
    raw() {
      return data;
    },
  };

  for (const name of COLLECTIONS) {
    store[name] = {
      all: () => data[name].slice(),
      get: id => data[name].find(x => x.id === id),
      where: fn => data[name].filter(fn),
      create(obj) {
        const rec = { ...obj, id: data.nextId++ };
        data[name].push(rec);
        save();
        return rec;
      },
      update(id, patch) {
        const rec = data[name].find(x => x.id === id);
        Object.assign(rec, patch);
        save();
        return rec;
      },
      remove(id) {
        data[name] = data[name].filter(x => x.id !== id);
        save();
      },
    };
  }
  return store;
}
```

- [ ] **Step 4: Draai tests, verwacht slagen**

Run: `node tests/run.mjs`
Expected: `6 geslaagd, 0 gefaald`.

- [ ] **Step 5: Commit**

```bash
git add js/store.js tests/store.test.mjs tests/run.mjs
git commit -m "feat: localStorage-datalaag met generieke collecties"
```

---

### Task 3: Seed-data

**Files:**
- Create: `js/seed.js`
- Test: `tests/seed.test.mjs`
- Modify: `tests/run.mjs` (import toevoegen)

**Interfaces:**
- Consumes: `createStore(storage)` uit Task 2.
- Produces: `seedIfEmpty(store, todayStr)` uit `js/seed.js` — vult de store alleen als `store.companies.all()` leeg is. `todayStr` is `YYYY-MM-DD`; alle datums in de seed worden daaruit berekend zodat de demo altijd actuele afspraken heeft. Seed bevat: 1 admin-loze platformcontext, 2 goedgekeurde bedrijven (één mét `mollieLinked: true`, één zonder), 1 bedrijf in de keuringswachtrij, 3 klanten (2 volledig geverifieerd, 1 met alleen e-mail), per goedgekeurd bedrijf 2 agenda's met openingstijden ma–vr 09:00–17:00 (slotduur 30 en 60 min), 1 blokkade volgende week, afspraken in alle vier de statussen (verleden en toekomst), en facturen in `draft`, `sent` (waarvan één met `dueAt` 10 dagen geleden) en `paid`.

**Veldnamen records** (bindend voor alle latere taken):

```js
// company: { id, name, street, houseNumber, postalCode, city, phone, email,
//   kvk, logoDataUrl, emailVerified, phoneVerified, approvedAt, rejectedReason,
//   mollieLinked, cancelHours }
// customer: { id, name, street, houseNumber, postalCode, city, phone, email,
//   emailVerified, phoneVerified }
// calendar: { id, companyId, name, slotMinutes, active }
// openingHour: { id, calendarId, weekday /*0=zo..6=za*/, start:'09:00', end:'17:00' }
// block: { id, calendarId, from:'YYYY-MM-DDTHH:mm', to, reason }
// appointment: { id, calendarId, customerId, startsAt, endsAt, status,
//   reminderSentAt, cancelledAt, completedAt, noShowAt }
// invoice: { id, issuerCompanyId /*null=platform*/, recipientType:'customer'|'company',
//   recipientId, appointmentId, number, status, issuedAt, dueAt, paidAt,
//   creditedInvoiceId, reminderCount, lastReminderAt,
//   lines: [{ description, qty, unitPriceCents, vatRate }],
//   totals: { exclCents, vatCents, inclCents, vatByRate } }
// mail: { id, to, subject, body, sentAt }
```

- [ ] **Step 1: Schrijf failing tests**

`tests/seed.test.mjs`:

```js
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
```

Voeg `import './seed.test.mjs';` toe aan `tests/run.mjs`.

- [ ] **Step 2: Draai tests, verwacht falen** — `node tests/run.mjs` → FAIL (seed.js ontbreekt).

- [ ] **Step 3: Implementeer `js/seed.js`**

Gebruik een hulpfunctie voor relatieve datums en maak de records volgens de veldnamen hierboven. Kern (volledig uitschrijven, dit is de vorm):

```js
export function seedIfEmpty(store, todayStr) {
  if (store.companies.all().length > 0) return;
  const day = offset => shiftDate(todayStr, offset);          // 'YYYY-MM-DD'
  const at = (offset, time) => `${day(offset)}T${time}`;       // 'YYYY-MM-DDTHH:mm'

  const salon = store.companies.create({
    name: 'Salon Zonnig', street: 'Hoofdstraat', houseNumber: '12',
    postalCode: '8011 AA', city: 'Zwolle', phone: '+31612345678',
    email: 'info@salonzonnig.nl', kvk: '12345678', logoDataUrl: null,
    emailVerified: true, phoneVerified: true, approvedAt: at(-30, '10:00'),
    rejectedReason: null, mollieLinked: true, cancelHours: 24,
  });
  const fysio = store.companies.create({ /* idem, mollieLinked: false */ });
  store.companies.create({ /* 'Kapper Nieuw', emailVerified+phoneVerified true, approvedAt: null → wachtrij */ });

  const anna = store.customers.create({
    name: 'Anna Jansen', street: 'Kerkweg', houseNumber: '3',
    postalCode: '8022 BB', city: 'Zwolle', phone: '+31687654321',
    email: 'anna@example.com', emailVerified: true, phoneVerified: true,
  });
  // + Bram (geverifieerd), Carla (alleen emailVerified)

  const knippen = store.calendars.create({ companyId: salon.id, name: 'Stoel 1', slotMinutes: 30, active: true });
  // + 2e agenda salon (60 min), 2 agenda's fysio
  for (const cal of store.calendars.all())
    for (const wd of [1, 2, 3, 4, 5])
      store.openingHours.create({ calendarId: cal.id, weekday: wd, start: '09:00', end: '17:00' });

  store.blocks.create({ calendarId: knippen.id, from: at(7, '00:00'), to: at(8, '23:59'), reason: 'Vakantie' });

  // afspraken: completed (-7d), no_show (-3d), cancelled (-1d), scheduled (+2d en +1d)
  const done = store.appointments.create({
    calendarId: knippen.id, customerId: anna.id,
    startsAt: at(-7, '10:00'), endsAt: at(-7, '10:30'), status: 'completed',
    reminderSentAt: null, cancelledAt: null, completedAt: at(-7, '11:00'), noShowAt: null,
  });
  // ... overige afspraken

  // facturen: paid (paidAt -5d), sent met dueAt -10d (vervallen), draft
  store.invoices.create({
    issuerCompanyId: salon.id, recipientType: 'customer', recipientId: anna.id,
    appointmentId: done.id, number: '2026-0001', status: 'paid',
    issuedAt: at(-7, '12:00'), dueAt: day(7), paidAt: at(-5, '09:12'),
    creditedInvoiceId: null, reminderCount: 0, lastReminderAt: null,
    lines: [{ description: 'Knipbeurt', qty: 1, unitPriceCents: 3500, vatRate: 21 }],
    totals: { exclCents: 3500, vatCents: 735, inclCents: 4235, vatByRate: { 21: 735 } },
  });
  // ... sent-factuur met dueAt = day(-10), en een draft zonder number/totals-bevriezing
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
```

De implementeur schrijft alle `/* idem */`-records volledig uit met eigen namen/adressen; de tests bepalen de aantallen (3 bedrijven, 3 klanten, 4 agenda's, alle statussen aanwezig, 1 wachtrijbedrijf, ≥1 vervallen sent-factuur).

- [ ] **Step 4: Draai tests, verwacht slagen** — `node tests/run.mjs` → `9 geslaagd, 0 gefaald`.

- [ ] **Step 5: Commit**

```bash
git add js/seed.js tests/seed.test.mjs tests/run.mjs
git commit -m "feat: demo-seed-data"
```

---

### Task 4: Slotgenerator

**Files:**
- Create: `js/logic/slots.js`
- Test: `tests/slots.test.mjs`
- Modify: `tests/run.mjs` (import toevoegen)

**Interfaces:**
- Produces: uit `js/logic/slots.js`:
  - `slotsForDay({ dateStr, openingHours, slotMinutes, appointments, blocks, now })` → array `{ startsAt, endsAt, free }`, gesorteerd op tijd. `openingHours` zijn alleen de records van de betreffende agenda; `appointments` en `blocks` idem. Sloten in het verleden (`endsAt <= now`) worden weggelaten. `free` is false als een actieve (niet-`cancelled`) afspraak exact op `startsAt` staat óf het slot overlapt met een blokkade.
  - `addMinutes(dt, min)` → `'YYYY-MM-DDTHH:mm'` (hulpfunctie, ook door UI gebruikt).

- [ ] **Step 1: Schrijf failing tests**

`tests/slots.test.mjs`:

```js
import { test, assertEqual, assertTrue } from './framework.mjs';
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
```

Voeg `import './slots.test.mjs';` toe aan `tests/run.mjs`.

- [ ] **Step 2: Draai tests, verwacht falen** — `node tests/run.mjs` → FAIL.

- [ ] **Step 3: Implementeer `js/logic/slots.js`**

```js
export function addMinutes(dt, min) {
  const d = new Date(dt);
  d.setMinutes(d.getMinutes() + min);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function slotsForDay({ dateStr, openingHours, slotMinutes, appointments, blocks, now }) {
  const weekday = new Date(dateStr + 'T12:00').getDay();
  const slots = [];
  for (const oh of openingHours.filter(h => h.weekday === weekday)) {
    let t = `${dateStr}T${oh.start}`;
    const end = `${dateStr}T${oh.end}`;
    while (addMinutes(t, slotMinutes) <= end) {
      const startsAt = t;
      const endsAt = addMinutes(t, slotMinutes);
      if (endsAt > now) {
        const taken = appointments.some(a => a.status !== 'cancelled' && a.startsAt === startsAt);
        const blocked = blocks.some(b => b.from < endsAt && b.to > startsAt);
        slots.push({ startsAt, endsAt, free: !taken && !blocked });
      }
      t = endsAt;
    }
  }
  return slots.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
}
```

- [ ] **Step 4: Draai tests, verwacht slagen** — `node tests/run.mjs` → `15 geslaagd, 0 gefaald`.

- [ ] **Step 5: Commit**

```bash
git add js/logic/slots.js tests/slots.test.mjs tests/run.mjs
git commit -m "feat: slotgenerator met blokkades en verleden-filter"
```

---

### Task 5: Factuurlogica (totalen, nummering, creditnota)

**Files:**
- Create: `js/logic/invoices.js`
- Test: `tests/invoices.test.mjs`
- Modify: `tests/run.mjs` (import toevoegen)

**Interfaces:**
- Produces: uit `js/logic/invoices.js`:
  - `calcTotals(lines)` → `{ exclCents, vatCents, inclCents, vatByRate }`. Per regel: `lineExcl = Math.round(qty * unitPriceCents)`, BTW per regel `Math.round(lineExcl * vatRate / 100)`, gesommeerd per tarief in `vatByRate` (alleen tarieven die voorkomen).
  - `nextInvoiceNumber(existingNumbers, year)` → `'JJJJ-NNNN'`, hoogste volgnummer binnen dat jaar + 1 (start 0001). `existingNumbers` is een array strings van dezelfde afzender.
  - `creditLines(lines)` → kopie van de regels met genegateerde `unitPriceCents` en omschrijving voorafgegaan door `'Creditering: '`.

- [ ] **Step 1: Schrijf failing tests**

`tests/invoices.test.mjs`:

```js
import { test, assertEqual } from './framework.mjs';
import { calcTotals, nextInvoiceNumber, creditLines } from '../js/logic/invoices.js';

test('calcTotals telt per BTW-tarief', () => {
  const t = calcTotals([
    { description: 'Knippen', qty: 1, unitPriceCents: 3500, vatRate: 21 },
    { description: 'Shampoo', qty: 2, unitPriceCents: 750, vatRate: 9 },
  ]);
  assertEqual(t, { exclCents: 5000, vatCents: 870, inclCents: 5870, vatByRate: { 21: 735, 9: 135 } });
});

test('calcTotals met negatieve regels (creditnota)', () => {
  const t = calcTotals([{ description: 'Creditering: Knippen', qty: 1, unitPriceCents: -3500, vatRate: 21 }]);
  assertEqual(t.inclCents, -4235);
});

test('nextInvoiceNumber per jaar', () => {
  assertEqual(nextInvoiceNumber([], 2026), '2026-0001');
  assertEqual(nextInvoiceNumber(['2026-0001', '2026-0007', '2025-0042'], 2026), '2026-0008');
});

test('creditLines negeert prijs en labelt', () => {
  assertEqual(
    creditLines([{ description: 'Knippen', qty: 1, unitPriceCents: 3500, vatRate: 21 }]),
    [{ description: 'Creditering: Knippen', qty: 1, unitPriceCents: -3500, vatRate: 21 }]
  );
});
```

Voeg `import './invoices.test.mjs';` toe aan `tests/run.mjs`.

- [ ] **Step 2: Draai tests, verwacht falen** — `node tests/run.mjs` → FAIL.

- [ ] **Step 3: Implementeer `js/logic/invoices.js`**

```js
export function calcTotals(lines) {
  let exclCents = 0;
  const vatByRate = {};
  for (const l of lines) {
    const lineExcl = Math.round(l.qty * l.unitPriceCents);
    exclCents += lineExcl;
    vatByRate[l.vatRate] = (vatByRate[l.vatRate] || 0) + Math.round(lineExcl * l.vatRate / 100);
  }
  const vatCents = Object.values(vatByRate).reduce((a, b) => a + b, 0);
  return { exclCents, vatCents, inclCents: exclCents + vatCents, vatByRate };
}

export function nextInvoiceNumber(existingNumbers, year) {
  const seq = existingNumbers
    .filter(n => n && n.startsWith(year + '-'))
    .map(n => parseInt(n.slice(5), 10));
  const next = (seq.length ? Math.max(...seq) : 0) + 1;
  return `${year}-${String(next).padStart(4, '0')}`;
}

export function creditLines(lines) {
  return lines.map(l => ({
    ...l,
    description: 'Creditering: ' + l.description,
    unitPriceCents: -l.unitPriceCents,
  }));
}
```

- [ ] **Step 4: Draai tests, verwacht slagen** — `node tests/run.mjs` → `19 geslaagd, 0 gefaald`.

- [ ] **Step 5: Commit**

```bash
git add js/logic/invoices.js tests/invoices.test.mjs tests/run.mjs
git commit -m "feat: factuurtotalen, nummering en creditnotaregels"
```

---

### Task 6: Statusovergangen afspraken

**Files:**
- Create: `js/logic/status.js`
- Test: `tests/status.test.mjs`
- Modify: `tests/run.mjs` (import toevoegen)

**Interfaces:**
- Consumes: tijdformaat `YYYY-MM-DDTHH:mm`.
- Produces: uit `js/logic/status.js`:
  - `canTransition(appointment, to, actor, now, cancelHours)` → `{ ok: true }` of `{ ok: false, reason: '...' }`. `actor` is `'company'` of `'customer'`. Regels: alleen vanuit `scheduled`; bedrijf mag naar `cancelled`/`completed`/`no_show` op elk moment; klant mag alléén naar `cancelled` en alléén als `now` minstens `cancelHours` uur vóór `startsAt` ligt.
  - `STATUS_LABELS` — `{ scheduled: 'Gemaakt', cancelled: 'Afgezegd', completed: 'Voltooid', no_show: 'Niet op komen dagen' }` (gebruikt door alle portalen).

- [ ] **Step 1: Schrijf failing tests**

`tests/status.test.mjs`:

```js
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
```

Voeg `import './status.test.mjs';` toe aan `tests/run.mjs`.

- [ ] **Step 2: Draai tests, verwacht falen** — `node tests/run.mjs` → FAIL.

- [ ] **Step 3: Implementeer `js/logic/status.js`**

```js
export const STATUS_LABELS = {
  scheduled: 'Gemaakt',
  cancelled: 'Afgezegd',
  completed: 'Voltooid',
  no_show: 'Niet op komen dagen',
};

export function canTransition(appointment, to, actor, now, cancelHours) {
  if (appointment.status !== 'scheduled')
    return { ok: false, reason: 'Alleen een gemaakte afspraak kan van status wisselen.' };
  if (actor === 'company') {
    if (['cancelled', 'completed', 'no_show'].includes(to)) return { ok: true };
    return { ok: false, reason: 'Ongeldige status.' };
  }
  if (to !== 'cancelled')
    return { ok: false, reason: 'Als klant kun je alleen afzeggen.' };
  const deadline = new Date(appointment.startsAt);
  deadline.setHours(deadline.getHours() - cancelHours);
  if (new Date(now) >= deadline)
    return { ok: false, reason: `Afzeggen kan tot ${cancelHours} uur van tevoren.` };
  return { ok: true };
}
```

- [ ] **Step 4: Draai tests, verwacht slagen** — `node tests/run.mjs` → `25 geslaagd, 0 gefaald`.

- [ ] **Step 5: Commit**

```bash
git add js/logic/status.js tests/status.test.mjs tests/run.mjs
git commit -m "feat: statusovergangen met afzegtermijn"
```

---

### Task 7: Herinneringsregels

**Files:**
- Create: `js/logic/reminders.js`
- Test: `tests/reminders.test.mjs`
- Modify: `tests/run.mjs` (import toevoegen)

**Interfaces:**
- Produces: uit `js/logic/reminders.js`:
  - `appointmentsDueForReminder(appointments, now)` → subset met `status === 'scheduled'`, `reminderSentAt == null`, en `startsAt` tussen `now` en `now + 24 uur`.
  - `invoicesDueForReminder(invoices, todayStr)` → subset met `status === 'sent'` en (`reminderCount === 0` en `todayStr >= dueAt + 7 dagen`) of (`reminderCount === 1` en `todayStr >= dueAt + 14 dagen`). Max 2 herinneringen. `dueAt` is een `YYYY-MM-DD`-string.
  - `shiftDays(dateStr, days)` → `YYYY-MM-DD` (hulpfunctie, ook voor seed/UI).

- [ ] **Step 1: Schrijf failing tests**

`tests/reminders.test.mjs`:

```js
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
    { id: 2, status: 'sent', dueAt: '2026-07-01', reminderCount: 1 },  // 14d: 15 juli
    { id: 3, status: 'sent', dueAt: '2026-07-01', reminderCount: 2 },
    { id: 4, status: 'sent', dueAt: '2026-07-08', reminderCount: 0 },  // 7d: 15 juli
    { id: 5, status: 'paid', dueAt: '2026-07-01', reminderCount: 0 },
  ];
  assertEqual(invoicesDueForReminder(inv, '2026-07-11').map(i => i.id), [1]);
  assertEqual(invoicesDueForReminder(inv, '2026-07-15').map(i => i.id), [1, 2, 4]);
});
```

Voeg `import './reminders.test.mjs';` toe aan `tests/run.mjs`.

- [ ] **Step 2: Draai tests, verwacht falen** — `node tests/run.mjs` → FAIL.

- [ ] **Step 3: Implementeer `js/logic/reminders.js`**

```js
import { addMinutes } from './slots.js';

export function shiftDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00');
  d.setDate(d.getDate() + days);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function appointmentsDueForReminder(appointments, now) {
  const limit = addMinutes(now, 24 * 60);
  return appointments.filter(a =>
    a.status === 'scheduled' && !a.reminderSentAt && a.startsAt > now && a.startsAt <= limit
  );
}

export function invoicesDueForReminder(invoices, todayStr) {
  return invoices.filter(i => {
    if (i.status !== 'sent') return false;
    if (i.reminderCount === 0) return todayStr >= shiftDays(i.dueAt, 7);
    if (i.reminderCount === 1) return todayStr >= shiftDays(i.dueAt, 14);
    return false;
  });
}
```

- [ ] **Step 4: Draai tests, verwacht slagen** — `node tests/run.mjs` → `28 geslaagd, 0 gefaald`.

- [ ] **Step 5: Commit**

```bash
git add js/logic/reminders.js tests/reminders.test.mjs tests/run.mjs
git commit -m "feat: herinneringsregels voor afspraken en facturen"
```

---

### Task 8: Rapportagelogica

**Files:**
- Create: `js/logic/reports.js`
- Test: `tests/reports.test.mjs`
- Modify: `tests/run.mjs` (import toevoegen)

**Interfaces:**
- Produces: uit `js/logic/reports.js`:
  - `periodKey(dt, period)` — `dt` is `YYYY-MM-DD...`-string; `period` ∈ `'day'|'week'|'month'|'quarter'|'year'` → resp. `'2026-07-11'`, `'2026-W28'` (ISO-week), `'2026-07'`, `'2026-Q3'`, `'2026'`.
  - `revenueByPeriod(invoices, period)` → object `{ [key]: inclCents }`, alléén facturen met `status === 'paid'`, gegroepeerd op `paidAt`. Creditnota's (negatieve totalen) tellen automatisch negatief mee.
  - `paymentStatusOfAppointment(appointment, invoices)` → `'betaald' | 'openstaand' | 'geen_factuur'` — zoekt de niet-`cancelled` factuur met `appointmentId === appointment.id`.
  - `inactiveCustomers(appointments, customers, minDays, maxDays, todayStr)` → klanten van wie de láátste afspraak (`startsAt`, elke status) tussen `minDays` en `maxDays` dagen geleden ligt; klanten zonder afspraken tellen niet mee. Retourneert `[{ customer, lastAppointmentAt }]`.

- [ ] **Step 1: Schrijf failing tests**

`tests/reports.test.mjs`:

```js
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
    { customerId: 1, startsAt: '2026-06-21T10:00' }, // 20 dagen geleden
    { customerId: 2, startsAt: '2026-07-09T10:00' }, // 2 dagen geleden
  ];
  const r = inactiveCustomers(appts, klanten, 10, 30, '2026-07-11');
  assertEqual(r.map(x => x.customer.id), [1]);
  assertEqual(r[0].lastAppointmentAt, '2026-06-21T10:00');
});
```

Voeg `import './reports.test.mjs';` toe aan `tests/run.mjs`.

- [ ] **Step 2: Draai tests, verwacht falen** — `node tests/run.mjs` → FAIL.

- [ ] **Step 3: Implementeer `js/logic/reports.js`**

```js
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
```

- [ ] **Step 4: Draai tests, verwacht slagen** — `node tests/run.mjs` → `33 geslaagd, 0 gefaald`.

- [ ] **Step 5: Commit**

```bash
git add js/logic/reports.js tests/reports.test.mjs tests/run.mjs
git commit -m "feat: rapportagelogica (omzet, betaalstatus, inactieve klanten)"
```

---

### Task 9: Gedeelde UI-helpers, stylesheet en browser-testrunner

**Files:**
- Create: `js/ui.js`, `css/style.css`, `tests.html`

**Interfaces:**
- Consumes: `createStore` (Task 2), `seedIfEmpty` (Task 3), `STATUS_LABELS` (Task 6).
- Produces: uit `js/ui.js` (door alle portaalpagina's gebruikt):
  - `initStore()` → store op `window.localStorage` + `seedIfEmpty(store, vandaag)`; retourneert de store.
  - `nowStr()` → huidige lokale tijd als `YYYY-MM-DDTHH:mm`; `todayStr()` → `YYYY-MM-DD`. (Enige plek waar de klok wordt gelezen.)
  - `euro(cents)` → `'€ 42,35'`.
  - `fmtDT(dt)` → `'za 11-07-2026 10:00'`.
  - `sendMail(store, to, subject, body)` → maakt een `mails`-record met `sentAt: nowStr()`.
  - `renderMailbox(store, containerEl)` → rendert het postvak-paneel (nieuwste eerst, klikbaar open/dicht) — op elke portaalpagina aanwezig.
  - `userPicker(containerEl, items, storageKey, onChange)` → "inloggen": een `<select>` met naam per item; keuze bewaard in localStorage onder `storageKey`.
  - `el(html)` → DOM-element uit een HTML-string (template-helper).

- [ ] **Step 1: Implementeer `js/ui.js`**

```js
import { createStore } from './store.js';
import { seedIfEmpty } from './seed.js';

export function nowStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function todayStr() { return nowStr().slice(0, 10); }

export function initStore() {
  const store = createStore(window.localStorage);
  seedIfEmpty(store, todayStr());
  return store;
}

export function euro(cents) {
  return '€ ' + (cents / 100).toFixed(2).replace('.', ',');
}

export function fmtDT(dt) {
  const d = new Date(dt);
  const dagen = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const p = n => String(n).padStart(2, '0');
  return `${dagen[d.getDay()]} ${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function sendMail(store, to, subject, body) {
  return store.mails.create({ to, subject, body, sentAt: nowStr() });
}

export function renderMailbox(store, containerEl) {
  const mails = store.mails.all().sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  containerEl.innerHTML = '';
  containerEl.appendChild(el(`<h2>📧 Postvak (simulatie) — ${mails.length}</h2>`));
  for (const m of mails) {
    const item = el(`<details class="mail">
      <summary>${m.sentAt.replace('T', ' ')} — aan ${m.to}: <strong>${m.subject}</strong></summary>
      <pre>${m.body}</pre>
    </details>`);
    containerEl.appendChild(item);
  }
}

export function userPicker(containerEl, items, storageKey, onChange) {
  const saved = Number(window.localStorage.getItem(storageKey));
  const sel = el(`<select></select>`);
  sel.appendChild(el(`<option value="">— kies —</option>`));
  for (const it of items) {
    const o = el(`<option value="${it.id}">${it.name}</option>`);
    if (it.id === saved) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    window.localStorage.setItem(storageKey, sel.value);
    onChange(sel.value ? Number(sel.value) : null);
  });
  containerEl.appendChild(sel);
  onChange(saved || null);
}
```

- [ ] **Step 2: Schrijf `css/style.css`**

Eén compacte stylesheet, o.a.: systeemfont; header met portaalnaam + navigatielinks naar de drie portalen; `main` max-breedte 960px; `.card` (witte kaart, rand, radius, padding); tabellen full-width met rand-onder per rij; `.slot`-knoppen (groen = vrij, grijs/doorgestreept = bezet); `.status-scheduled/.status-cancelled/.status-completed/.status-no_show` badgekleuren (blauw/grijs/groen/rood); `.mail pre` met lichte achtergrond; formulieren met gestapelde labels; knoppen `.btn` en `.btn-danger`. Volledige stylesheet uitschrijven (~100 regels), geen externe fonts of CDN's.

- [ ] **Step 3: Schrijf `tests.html`**

```html
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><title>Tests — prototype</title>
<link rel="stylesheet" href="css/style.css"></head>
<body>
<main><h1>Tests</h1><pre id="out">Bezig…</pre></main>
<script type="module">
  import './tests/framework.test.mjs';
  import './tests/store.test.mjs';
  import './tests/seed.test.mjs';
  import './tests/slots.test.mjs';
  import './tests/invoices.test.mjs';
  import './tests/status.test.mjs';
  import './tests/reminders.test.mjs';
  import './tests/reports.test.mjs';
  import { runAll } from './tests/framework.mjs';
  const lines = [];
  runAll(msg => lines.push(msg));
  document.getElementById('out').textContent = lines.join('\n');
</script>
</body>
</html>
```

Let op: `tests/store.test.mjs` en `tests/seed.test.mjs` gebruiken hun eigen `memStorage`, dus browser-uitvoering raakt de echte demo-data niet.

- [ ] **Step 4: Verifieer**

Run: `node tests/run.mjs` → nog steeds `33 geslaagd, 0 gefaald`.
Open `tests.html` via een lokale server (`python -m http.server`) → zelfde uitslag op de pagina.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js css/style.css tests.html
git commit -m "feat: gedeelde UI-helpers, stylesheet en browser-testrunner"
```

---

### Task 10: Klantportaal (index.html)

**Files:**
- Create: `index.html`, `js/app-klant.js`

**Interfaces:**
- Consumes: `initStore/nowStr/todayStr/euro/fmtDT/el/sendMail/renderMailbox/userPicker` (Task 9), `slotsForDay/addMinutes` (Task 4), `canTransition/STATUS_LABELS` (Task 6).
- Produces: het boekingspad dat in de demo wordt getoond; geen exports.

**Pagina-indeling `index.html`** (alle portaalpagina's volgen dit patroon):

```html
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Afspraken — Klant</title><link rel="stylesheet" href="css/style.css"></head>
<body>
<header>
  <strong>Klantportaal</strong>
  <nav><a href="index.html">Klant</a> <a href="bedrijf.html">Bedrijf</a> <a href="admin.html">Admin</a></nav>
  <div id="user-picker"></div>
</header>
<main>
  <section id="registratie" class="card"></section>
  <section id="bedrijven" class="card"></section>
  <section id="boeken" class="card" hidden></section>
  <section id="mijn-afspraken" class="card"></section>
  <section id="mijn-facturen" class="card"></section>
</main>
<aside id="mailbox" class="card"></aside>
<script type="module" src="js/app-klant.js"></script>
</body>
</html>
```

**Gedrag `js/app-klant.js`** (implementeer als losse renderfuncties die elkaar aanroepen na elke mutatie; module-globals `store`, `currentCustomerId`):

1. **Init:** `store = initStore()`; `userPicker` op `#user-picker` met `store.customers.all()` onder sleutel `akp-klant`; bij wissel alles herrenderen. Niets geselecteerd → alleen registratie + bedrijvenlijst tonen.
2. **Registratie (`#registratie`):** formulier met naam, straat, huisnummer, postcode, plaats, telefoon, e-mail. Submit → `customers.create({ ..., emailVerified: false, phoneVerified: false })` + twee simulaties:
   - `sendMail(store, email, 'Bevestig je e-mailadres', '...')` en een knop "✔ Klik hier om de e-maillink te simuleren" die `emailVerified: true` zet;
   - een blok "SMS-code (simulatie): **483920**" (vast getoond, `Math.floor(Math.random()*900000+100000)` gegenereerd en in het record bewaard als `smsCode`) met invoerveld; juiste code → `phoneVerified: true`.
   - Zolang de gekozen klant niet dubbel geverifieerd is: gele banner "Rond eerst je verificatie af" en de boek-knoppen uitgeschakeld.
3. **Bedrijvenlijst (`#bedrijven`):** alle bedrijven met `approvedAt != null`, als kaartjes (logo indien aanwezig, naam, plaats) met per agenda (`active`) een knop "Boek bij {agendanaam}".
4. **Boeken (`#boeken`):** na agendakeuze zichtbaar. Weeknavigatie (‹ vorige / volgende ›, start = huidige week, geen weken in het verleden). Per dag (ma–zo) de sloten van `slotsForDay` met `openingHours/appointments/blocks` van die agenda en `now: nowStr()`. Vrije sloten zijn knoppen; klik → bevestigingsdialoog → `appointments.create({ calendarId, customerId: currentCustomerId, startsAt, endsAt, status: 'scheduled', reminderSentAt: null, cancelledAt: null, completedAt: null, noShowAt: null })` + `sendMail` naar klant én bedrijf ("Afspraak bevestigd: {fmtDT}"). **Race-simulatie:** vlak vóór create nogmaals controleren of het slot nog vrij is; zo niet → melding "Dit slot is zojuist bezet." (documenteert het gedrag dat in Laravel de unieke index afdwingt).
5. **Mijn afspraken (`#mijn-afspraken`):** tabel (bedrijf, agenda, `fmtDT(startsAt)`, statusbadge met `STATUS_LABELS`). Bij `scheduled`: knop "Afzeggen" die `canTransition(appt, 'cancelled', 'customer', nowStr(), company.cancelHours)` checkt; bij `ok` → status + `cancelledAt` zetten, mail naar het bedrijf; anders de `reason` tonen.
6. **Mijn facturen (`#mijn-facturen`):** tabel (nummer, bedrijf, `euro(totals.inclCents)`, status). Bij `sent` van een bedrijf mét `mollieLinked`: link "Betalen" naar `betaal.html?invoice={id}`. Knop "Bekijk" → printbare factuurweergave (nieuw venster via `window.open` met dezelfde stylesheet: afzender, ontvanger, regels, BTW-uitsplitsing per tarief uit `totals.vatByRate`, totaal).
7. Na elke mutatie: `renderMailbox(store, document.getElementById('mailbox'))` en de betrokken secties opnieuw renderen.

- [ ] **Step 1: Schrijf `index.html`** zoals hierboven.
- [ ] **Step 2: Implementeer `js/app-klant.js`** volgens gedragspunten 1–7; elke sectie een eigen functie (`renderRegistratie()`, `renderBedrijven()`, `renderBoeken()`, `renderMijnAfspraken()`, `renderMijnFacturen()`).
- [ ] **Step 3: Handmatige verificatie** — `python -m http.server`, open http://localhost:8000: registreer een nieuwe klant, doorloop beide verificaties, boek een slot bij Salon Zonnig, zie twee mails in het postvak; probeer hetzelfde slot als andere klant (via de kiezer) → "zojuist bezet"; zeg een afspraak < 24 uur vooraf af → foutmelding met reden.
- [ ] **Step 4: Draai `node tests/run.mjs`** — nog steeds alles groen (geen logica gewijzigd).
- [ ] **Step 5: Commit**

```bash
git add index.html js/app-klant.js
git commit -m "feat: klantportaal met registratie, boeken en facturen"
```

---

### Task 11: Nep-Mollie-betaalpagina

**Files:**
- Create: `betaal.html`, `js/app-betaal.js`

**Interfaces:**
- Consumes: `initStore/euro/nowStr/todayStr/sendMail` (Task 9). Query-parameter `invoice` (id).
- Produces: betaalflow waar klantportaal (Task 10) en bedrijfsportaal (Task 12) naartoe linken.

- [ ] **Step 1: Schrijf `betaal.html`** — zelfde skelet als Task 10, maar met één `.card`-sectie `#betaal` en een duidelijke banner "🔶 Dit is een gesimuleerde Mollie-betaalpagina".

- [ ] **Step 2: Implementeer `js/app-betaal.js`**

```js
import { initStore, euro, nowStr, sendMail } from './ui.js';

const store = initStore();
const id = Number(new URLSearchParams(location.search).get('invoice'));
const inv = store.invoices.get(id);
const box = document.getElementById('betaal');

if (!inv) {
  box.textContent = 'Factuur niet gevonden.';
} else if (inv.status === 'paid') {
  box.innerHTML = `<h1>Al betaald</h1><p>Factuur ${inv.number} is al voldaan.</p>`;
} else if (inv.status !== 'sent') {
  box.innerHTML = `<h1>Niet betaalbaar</h1><p>Factuur ${inv.number} heeft status ${inv.status}.</p>`;
} else {
  box.innerHTML = `<h1>Betaal ${euro(inv.totals.inclCents)}</h1>
    <p>Factuur ${inv.number}</p>
    <button class="btn" id="pay">iDEAL — Betaal nu (simulatie)</button>
    <a href="index.html">Annuleren</a>`;
  document.getElementById('pay').addEventListener('click', () => {
    store.invoices.update(inv.id, { status: 'paid', paidAt: nowStr() });
    const ontvanger = inv.recipientType === 'customer'
      ? store.customers.get(inv.recipientId) : store.companies.get(inv.recipientId);
    const afzender = inv.issuerCompanyId ? store.companies.get(inv.issuerCompanyId) : { name: 'Platform', email: 'platform@example.com' };
    sendMail(store, ontvanger.email, `Betaling ontvangen: ${inv.number}`, `Bedankt, ${euro(inv.totals.inclCents)} is voldaan.`);
    sendMail(store, afzender.email, `Factuur ${inv.number} is betaald`, `Ontvangen van ${ontvanger.name}.`);
    box.innerHTML = `<h1>✅ Betaald</h1><p><a href="index.html">Terug naar het klantportaal</a></p>`;
  });
}
```

- [ ] **Step 3: Handmatige verificatie** — betaal vanuit het klantportaal een `sent`-factuur; status wordt `paid`, twee mails in het postvak, terugknop werkt; herlaad de pagina → "Al betaald".
- [ ] **Step 4: Commit**

```bash
git add betaal.html js/app-betaal.js
git commit -m "feat: gesimuleerde Mollie-betaalpagina"
```

---

### Task 12: Bedrijfsportaal (bedrijf.html)

**Files:**
- Create: `bedrijf.html`, `js/app-bedrijf.js`

**Interfaces:**
- Consumes: Task 9-helpers; `slotsForDay` (Task 4); `calcTotals/nextInvoiceNumber/creditLines` (Task 5); `canTransition/STATUS_LABELS` (Task 6); `shiftDays` (Task 7); `paymentStatusOfAppointment/revenueByPeriod/inactiveCustomers` (Task 8).
- Produces: geen exports; de secties hieronder.

**`bedrijf.html`:** zelfde skelet als Task 10, secties: `#registratie`, `#agendas`, `#afspraken`, `#facturen`, `#rapportages`, plus `#mailbox`. Gebruikerskiezer met `store.companies.all()` onder sleutel `akp-bedrijf`.

**Gedrag `js/app-bedrijf.js`:**

1. **Registratie bedrijf:** als klantregistratie (Task 10 punt 2) plus velden KVK-nummer en logo (`<input type="file">`; `FileReader.readAsDataURL` → `logoDataUrl`, weergave 300×300 via CSS `object-fit: contain` — geen echte herschaling in het prototype). Na dubbele verificatie toont een banner "Wacht op goedkeuring door de beheerder" zolang `approvedAt == null`; bij `rejectedReason` een rode banner met de reden. Niet-goedgekeurde bedrijven zien de overige secties niet.
2. **Agenda's (`#agendas`):** lijst agenda's met naam, slotduur, actief-schakelaar. "Nieuwe agenda" uitgeschakeld bij 4 stuks (tekst "maximaal 4"). Per agenda:
   - openingstijden-bewerker: per weekdag (ma–zo) tijdvakken toevoegen/verwijderen (`openingHours`-records);
   - blokkades: lijst + formulier (van, tot, reden) → `blocks.create`; bestaande afspraken binnen de blokkade worden getoond met knop "Afzeggen" (bedrijfsovergang, mail naar klant);
   - instelling afzegtermijn (`cancelHours`) op bedrijfsniveau en "Mollie gekoppeld" als checkbox (`mollieLinked`) — simulatie van de API-sleutel.
3. **Afspraken (`#afspraken`):** tabel van alle afspraken op de agenda's van dit bedrijf (klantnaam, agenda, `fmtDT`, statusbadge), filter op status en op dag. Bij `scheduled` drie knoppen: Voltooid / Afgezegd / No-show → `canTransition(appt, to, 'company', ...)`, status + bijbehorend tijdstempel (`completedAt`/`cancelledAt`/`noShowAt`) zetten, mail naar de klant. Bij `completed` zonder factuur: knop "→ Factuur maken" (springt naar `#facturen` met voorgevulde klant en `appointmentId`).
4. **Facturen (`#facturen`):**
   - opsteller: klantkeuze (of voorgevuld), regels-editor (omschrijving, aantal, stukprijs in euro's → centen, BTW-tarief 21/9/0), live totalen via `calcTotals`. "Opslaan als concept" → `invoices.create({ status: 'draft', number: null, ... })`. Concepten zijn bewerkbaar en verwijderbaar.
   - "Versturen" → `number: nextInvoiceNumber(nummers van deze afzender, huidig jaar)`, `issuedAt: nowStr()`, `dueAt: shiftDays(todayStr(), 14)`, `totals` bevriezen, status `sent`, mail met factuurregels in de body en (alleen bij `mollieLinked`) de betaallink `betaal.html?invoice={id}`.
   - lijst met filter betaald/onbetaald; acties per `sent`: "Markeer betaald" (handmatig, voor overschrijving/contant), "Annuleren" (status `cancelled`, alleen zolang onbetaald), "Creditnota" → nieuwe factuur met `lines: creditLines(origineel.lines)`, eigen nummer, `creditedInvoiceId: origineel.id`, meteen `sent` + mail. "Bekijk" → printbare weergave (als Task 10 punt 6).
5. **Rapportages (`#rapportages`):**
   - voltooide afspraken met `paymentStatusOfAppointment` (badge betaald / openstaand / geen factuur);
   - omzet: periodekiezer (dag/week/maand/kwartaal/jaar) → tabel uit `revenueByPeriod` over de eigen facturen, `euro()`-bedragen, aflopend gesorteerd op periode;
   - inactieve klanten: twee invoervelden (min X, max Y, defaults 30/90) → `inactiveCustomers` over de eigen afspraken en de klanten die ooit bij dit bedrijf boekten.

- [ ] **Step 1: Schrijf `bedrijf.html`.**
- [ ] **Step 2: Implementeer `js/app-bedrijf.js`** — één renderfunctie per sectie, net als Task 10.
- [ ] **Step 3: Handmatige verificatie** — als Salon Zonnig: voltooi de geplande seed-afspraak → maak er een factuur bij → verstuur → betaal via de betaallink (klantportaal) → zie omzet in de rapportage stijgen; maak een creditnota → omzet daalt; voeg een blokkade toe → sloten verdwijnen in het klantportaal; probeer een 5e agenda → geblokkeerd.
- [ ] **Step 4: Draai `node tests/run.mjs`** — alles groen.
- [ ] **Step 5: Commit**

```bash
git add bedrijf.html js/app-bedrijf.js
git commit -m "feat: bedrijfsportaal met agenda's, facturen en rapportages"
```

---

### Task 13: Adminportaal (admin.html)

**Files:**
- Create: `admin.html`, `js/app-admin.js`

**Interfaces:**
- Consumes: Task 9-helpers; factuurfuncties (Task 5); `appointmentsDueForReminder/invoicesDueForReminder` (Task 7); `revenueByPeriod` (Task 8); `STATUS_LABELS` (Task 6).
- Produces: geen exports.

**`admin.html`:** zelfde skelet; geen gebruikerskiezer (admin is impliciet ingelogd); secties `#keuring`, `#platformfacturen`, `#rapportage`, `#beheer`, `#mailbox`.

**Gedrag `js/app-admin.js`:**

1. **Keuringswachtrij (`#keuring`):** bedrijven met `approvedAt == null && !rejectedReason`, kaart met alle registratiegegevens (naam, adres, KVK, e-mail/telefoon-verificatiestatus). Knoppen: "Goedkeuren" → `approvedAt: nowStr()` + mail "Je bedrijf is goedgekeurd"; "Afkeuren" → promptveld voor reden → `rejectedReason` + mail met reden.
2. **Platformfacturen (`#platformfacturen`):** zelfde factuur-editor als Task 12 punt 4, maar `issuerCompanyId: null`, `recipientType: 'company'`, nummering over de platformfacturen. Lijst betaald/onbetaald. De betaallink werkt via dezelfde `betaal.html`.
3. **Rapportage (`#rapportage`):** tabel per bedrijf: aantal afspraken (totaal + per status) en omzet (som `paid`-facturen van dat bedrijf) binnen een periodekiezer (deze maand / dit kwartaal / dit jaar / alles).
4. **Beheer (`#beheer`):**
   - knop **"▶ Simuleer dagelijkse taken"**: draait `appointmentsDueForReminder(alle afspraken, nowStr())` → per stuk mail "Herinnering: je afspraak morgen om {fmtDT}" + `reminderSentAt: nowStr()`; en `invoicesDueForReminder(alle facturen, todayStr())` → per stuk mail "Betalingsherinnering factuur {number}" met betaallink + `reminderCount + 1`, `lastReminderAt: nowStr()`. Toont daarna "N afspraakherinneringen, M betalingsherinneringen verstuurd."
   - knop **"↺ Reset demo-data"**: bevestigingsdialoog → `store.reset()` + `seedIfEmpty(store, todayStr())` + herladen.
5. Alle mutaties herrenderen het postvak.

- [ ] **Step 1: Schrijf `admin.html`.**
- [ ] **Step 2: Implementeer `js/app-admin.js`.**
- [ ] **Step 3: Handmatige verificatie** — keur "Kapper Nieuw" goed → verschijnt in de bedrijvenlijst van het klantportaal; keur een testregistratie af met reden → rode banner in het bedrijfsportaal; "Simuleer dagelijkse taken" → betalingsherinnering voor de vervallen seed-factuur in het postvak; tweede klik verstuurt 'm niet opnieuw (reminderCount=1, pas weer op +14 dagen); reset → seed-data terug.
- [ ] **Step 4: Draai `node tests/run.mjs`** — alles groen.
- [ ] **Step 5: Commit**

```bash
git add admin.html js/app-admin.js
git commit -m "feat: adminportaal met keuring, platformfacturen en dagelijkse taken"
```

---

### Task 14: Eindcontrole en GitHub Pages

**Files:**
- Modify: `README.md` (screenshots/known limitations sectie), eventuele fixes uit de eindcontrole.

- [ ] **Step 1: Doorloop het volledige demo-script** met een schone browser (of na "Reset demo-data"):
  1. Klant registreren → e-mail + SMS simuleren → boeken bij Salon Zonnig.
  2. Bedrijf: afspraak voltooien → factuur maken → versturen → klant betaalt via nep-Mollie.
  3. Creditnota maken; factuur annuleren; handmatig betaald markeren (bedrijf zonder Mollie).
  4. Blokkade toevoegen → klantsloten verdwijnen; afzegtermijn testen.
  5. Admin: bedrijf goedkeuren/afkeuren; dagelijkse taken simuleren; rapportages controleren (omzet klopt met betaalde facturen, creditnota negatief).
  6. `tests.html` en `node tests/run.mjs` → alles groen.
- [ ] **Step 2: Los gevonden problemen op** en commit per fix (`fix: ...`).
- [ ] **Step 3: Vul `README.md` aan** met een sectie "Beperkingen van het prototype" (geen echte auth, geen echte mail/SMS/Mollie, logo niet echt herschaald, data per browser) en het demo-script uit Step 1.
- [ ] **Step 4: Commit en publiceer**

```bash
git add README.md
git commit -m "docs: demo-script en beperkingen"
```

Daarna (handmatig door de gebruiker of via `gh`): repo naar GitHub pushen en in Settings → Pages de bron op `main` / root zetten. Controleer de gepubliceerde URL: alle drie portalen + `tests.html` werken (ES-modules vereisen https of localhost — GitHub Pages voldoet).

---

## Self-review (uitgevoerd)

- **Spec-dekking:** registratie + verificatiesimulaties (T10/T12), keuring (T13), agenda's/openingstijden/blokkades/max 4 (T12, logica T4), boeken incl. race-melding en afzegtermijn (T10, logica T4/T6), statussen (T6/T12), facturen incl. BTW/PDF-vervanger (printweergave)/creditnota/annuleren/handmatig betaald (T5/T12), nep-Mollie (T11), herinneringen afspraak + betaling via simulatieknop (T7/T13), rapportages incl. inactieve klanten en admin-overzicht per bedrijf (T8/T12/T13), postvak overal (T9), reset-knop (T13), GitHub Pages (T1/T14). Geen gaten gevonden.
- **Placeholders:** de `/* idem */`-plekken in Task 3 zijn bewust: de tests leggen de aantallen en eigenschappen vast en de taak zegt expliciet dat de implementeur ze volledig uitschrijft. Elders geen placeholders.
- **Typeconsistentie:** veldnamen komen uit het bindende blok in Task 3; functienamen in Consumes/Produces-blokken gecontroleerd (`slotsForDay`, `addMinutes`, `calcTotals`, `nextInvoiceNumber`, `creditLines`, `canTransition`, `STATUS_LABELS`, `appointmentsDueForReminder`, `invoicesDueForReminder`, `shiftDays`, `periodKey`, `revenueByPeriod`, `paymentStatusOfAppointment`, `inactiveCustomers`).





