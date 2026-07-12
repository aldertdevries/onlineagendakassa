# Klantpagina's per bedrijf — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Het statische prototype ombouwen naar per-bedrijf gebrande klantpagina's: uniek publiek ID in de URL, gast-boeken met formaatvalidatie, en code-verificatie (e-mail óf telefoon) voor het beheren van afspraken en het lezen van berichten.

**Architecture:** Het bestaande prototype (HTML + vanilla ES-modules + localStorage-store) blijft. Nieuwe pure logica komt in `js/logic/klant-toegang.js` (getest via het bestaande testframework). `index.html`/`js/app-klant.js` worden herschreven tot een per-bedrijf-pagina gestuurd door `?bedrijf=<publicId>`. Klanten krijgen `companyId`; mails aan klanten krijgen `companyId`/`customerId`-metadata zodat de berichtenweergave per klant per bedrijf kan filteren.

**Tech Stack:** Vanilla JS (ES-modules), localStorage, eigen testframework (`tests/framework.mjs`, runner `node tests/run.mjs` + `tests.html`). Geen buildstap, geen dependencies.

**Spec:** `docs/superpowers/specs/2026-07-12-klantpaginas-per-bedrijf-design.md` (en de bijgewerkte hoofdspec `2026-07-11-afspraak-kassa-design.md`).

## Global Constraints

- Alle UI-teksten in het Nederlands; code-identifiers volgen de bestaande mix (Engels voor data, Nederlands voor UI-functies zoals `renderBoeken`).
- Geen frameworks, geen buildstap; bestanden moeten direct op GitHub Pages werken.
- Rekenlogica/valideerbare regels als pure functies in `js/logic/` met tests; UI-code wordt niet unit-getest (bestaand patroon).
- Bedragen in centen; datum/tijd-strings in het formaat `YYYY-MM-DDTHH:MM` (zoals `nowStr()` levert).
- Testcommando: `node tests/run.mjs` — verwacht `N geslaagd, 0 gefaald` en exitcode 0.
- Commit na elke taak; commit-messages in het Nederlands volgens bestaande stijl (`feat:`, `fix:`, `docs:`).

---

### Task 1: Pure logica `js/logic/klant-toegang.js`

**Files:**
- Create: `js/logic/klant-toegang.js`
- Create: `tests/klant-toegang.test.mjs`
- Modify: `tests/run.mjs` (import toevoegen)
- Modify: `tests.html` (import toevoegen)

**Interfaces:**
- Consumes: niets (pure module).
- Produces (gebruikt door Taken 5 en 6):
  - `normalizePhone(input: string) => string|null` — normaliseert naar `+31XXXXXXXXX` of `null` bij ongeldig.
  - `validateKlantGegevens({name, email, phone}) => { ok: boolean, errors: {name?, email?, phone?} }`
  - `findCustomer(customers: object[], companyId: number, email: string, phone: string) => object|null`
  - `makePublicId(rand?: () => number) => string` — 8 tekens uit `'abcdefghjkmnpqrstuvwxyz23456789'`.
  - `checkAccessCode(rec: {code, expiresAt, attempts}|null, input: string, now: string) => { ok: boolean, reason?: string, telPoging?: boolean }`
  - `CODE_GELDIG_MINUTEN = 10`, `CODE_MAX_POGINGEN = 3`

- [ ] **Step 1: Schrijf de falende tests**

Maak `tests/klant-toegang.test.mjs`:

```js
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
```

Voeg in `tests/run.mjs` na `import './reports.test.mjs';` toe:

```js
import './klant-toegang.test.mjs';
```

Voeg in `tests.html` na `import './tests/reports.test.mjs';` toe:

```js
  import './tests/klant-toegang.test.mjs';
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `node tests/run.mjs`
Expected: FAIL — module `../js/logic/klant-toegang.js` bestaat niet (ERR_MODULE_NOT_FOUND).

- [ ] **Step 3: Implementeer `js/logic/klant-toegang.js`**

```js
// Pure logica voor de klantpagina per bedrijf: invoervalidatie bij het boeken,
// klant-matching binnen een bedrijf, publieke bedrijfs-ID's en toegangscodes.

export const CODE_GELDIG_MINUTEN = 10;
export const CODE_MAX_POGINGEN = 3;

export function normalizePhone(input) {
  const s = String(input || '').replace(/[\s-]/g, '');
  if (/^\+31[1-9]\d{8}$/.test(s)) return s;
  if (/^0[1-9]\d{8}$/.test(s)) return '+31' + s.slice(1);
  return null;
}

export function validateKlantGegevens({ name, email, phone }) {
  const errors = {};
  if (!String(name || '').trim()) errors.name = 'Vul je naam in.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '')))
    errors.email = 'Vul een geldig e-mailadres in.';
  if (!normalizePhone(phone))
    errors.phone = 'Vul een geldig Nederlands telefoonnummer in (06… of +316…).';
  return { ok: Object.keys(errors).length === 0, errors };
}

export function findCustomer(customers, companyId, email, phone) {
  const mail = String(email || '').trim().toLowerCase();
  const tel = normalizePhone(phone);
  return customers.find(c => c.companyId === companyId &&
    ((mail && c.email.toLowerCase() === mail) || (tel && c.phone === tel))) || null;
}

// Alfabet zonder verwarrende tekens (geen 0/o, 1/l/i).
export function makePublicId(rand = Math.random) {
  const alfabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += alfabet[Math.floor(rand() * alfabet.length)];
  return id;
}

export function checkAccessCode(rec, input, now) {
  if (!rec) return { ok: false, reason: 'Vraag eerst een code aan.' };
  if (now > rec.expiresAt)
    return { ok: false, reason: 'De code is verlopen. Vraag een nieuwe aan.' };
  if (rec.attempts >= CODE_MAX_POGINGEN)
    return { ok: false, reason: 'Te veel pogingen. Vraag een nieuwe code aan.' };
  if (String(input).trim() !== rec.code)
    return { ok: false, reason: 'Onjuiste code.', telPoging: true };
  return { ok: true };
}
```

- [ ] **Step 4: Draai de tests en zie ze slagen**

Run: `node tests/run.mjs`
Expected: alle tests slagen, `0 gefaald`.

- [ ] **Step 5: Commit**

```bash
git add js/logic/klant-toegang.js tests/klant-toegang.test.mjs tests/run.mjs tests.html
git commit -m "feat: pure logica voor klantvalidatie, matching, publieke ID's en toegangscodes"
```

---

### Task 2: Store — `accessCodes`-collectie en verse opslagsleutel

**Files:**
- Modify: `js/store.js:1-5`
- Modify: `tests/store.test.mjs` (test toevoegen)

**Interfaces:**
- Produces: `store.accessCodes` met dezelfde API als elke collectie (`all/get/where/create/update/remove`). Records: `{ id, companyId, customerId, channel: 'email'|'sms', code, expiresAt, attempts }`.
- De opslagsleutel wordt `akp-data-v2` zodat bestaande demo-data (zonder `publicId`/`companyId`) niet halfslachtig meegenomen wordt — bezoekers beginnen automatisch met verse seed-data.

- [ ] **Step 1: Schrijf de falende test**

Voeg onderaan `tests/store.test.mjs` toe (gebruik de bestaande `memStorage`-helper in dat bestand; als die daar anders heet, volg het bestaande patroon van de eerste test):

```js
test('store heeft een accessCodes-collectie', () => {
  const s = createStore(memStorage());
  const rec = s.accessCodes.create({ companyId: 1, customerId: 2, channel: 'sms', code: '123456', expiresAt: '2026-07-12T10:10', attempts: 0 });
  assertEqual(s.accessCodes.get(rec.id).code, '123456', 'aanmaken/ophalen:');
});
```

- [ ] **Step 2: Draai de tests en zie de nieuwe test falen**

Run: `node tests/run.mjs`
Expected: FAIL `store heeft een accessCodes-collectie` (accessCodes is undefined).

- [ ] **Step 3: Pas `js/store.js` aan**

```js
const KEY = 'akp-data-v2';
const COLLECTIONS = [
  'companies', 'customers', 'calendars', 'openingHours',
  'blocks', 'appointments', 'invoices', 'mails', 'accessCodes',
];
```

(De rest van het bestand blijft ongewijzigd.)

- [ ] **Step 4: Draai de tests en zie ze slagen**

Run: `node tests/run.mjs`
Expected: `0 gefaald`.

- [ ] **Step 5: Commit**

```bash
git add js/store.js tests/store.test.mjs
git commit -m "feat: accessCodes-collectie en verse opslagsleutel (v2)"
```

---

### Task 3: Seed — publieke ID's en klanten per bedrijf

**Files:**
- Modify: `js/seed.js`
- Modify: `tests/seed.test.mjs`

**Interfaces:**
- Produces: seed-bedrijven met vast `publicId` (Salon Zonnig `k7f3q9w2`, Fysio Vitaal `p2m8x4r6`, Kapper Nieuw `h9t5w3n7`); seed-klanten met `companyId` en zonder `emailVerified`/`phoneVerified`/`smsCode`. Afspraken en facturen verwijzen alleen naar klanten van het eigen bedrijf.

- [ ] **Step 1: Schrijf de falende tests**

Voeg onderaan `tests/seed.test.mjs` toe:

```js
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
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `node tests/run.mjs`
Expected: FAIL op beide nieuwe tests (publicId/companyId ontbreken).

- [ ] **Step 3: Pas `js/seed.js` aan**

Voeg `publicId` toe aan de drie bedrijven en vervang het klantenblok. De bedrijven:

```js
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
```

Het klantenblok wordt (dezelfde persoon bij twee bedrijven = twee records):

```js
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
```

Werk de verwijzingen in de afspraken en facturen bij (agenda's `stoel1`/`stoel2` zijn van salon, `kamer1`/`kamer2` van fysio):

| record | oud | nieuw |
|---|---|---|
| afspraak `done` (stoel1, completed) | `anna.id` | `annaSalon.id` |
| afspraak `doneBram` (kamer1, completed) | `bram.id` | `bramFysio.id` |
| afspraak no_show (stoel1) | `bram.id` | `bramSalon.id` |
| afspraak cancelled (kamer1) | `anna.id` | `annaFysio.id` |
| afspraak scheduled (stoel1) | `anna.id` | `annaSalon.id` |
| afspraak scheduled (kamer1) | `bram.id` | `bramFysio.id` |
| factuur paid (salon) | `recipientId: anna.id` | `annaSalon.id` |
| factuur sent (fysio) | `recipientId: bram.id` | `bramFysio.id` |
| factuur draft (salon) | `recipientId: bram.id` | `bramSalon.id` |

- [ ] **Step 4: Draai de tests en zie ze slagen**

Run: `node tests/run.mjs`
Expected: `0 gefaald` (ook de bestaande seed-tests).

- [ ] **Step 5: Commit**

```bash
git add js/seed.js tests/seed.test.mjs
git commit -m "feat: seed met publieke bedrijfs-ID's en klanten per bedrijf"
```

---

### Task 4: Mail-metadata (`companyId`/`customerId`) in `sendMail` en alle klant-mails

**Files:**
- Modify: `js/ui.js:40-42` (`sendMail`)
- Modify: `js/app-bedrijf.js` (`zetStatus`, `verstuurFactuur`, creditnota-handler)
- Modify: `js/app-admin.js` (dagelijkse taken)

(`js/app-betaal.js` krijgt zijn metadata in Taak 9, samen met de terug-link.)

**Interfaces:**
- Produces: `sendMail(store, to, subject, body, meta = {})` — `meta` wordt op het mailrecord gespreid. Voor elke mail aan een klant wordt `{ companyId, customerId }` meegegeven; Taak 5 filtert de berichtenweergave hierop (`m.companyId === company.id && m.customerId === klant.id`).

- [ ] **Step 1: Pas `sendMail` in `js/ui.js` aan**

```js
export function sendMail(store, to, subject, body, meta = {}) {
  return store.mails.create({ to, subject, body, sentAt: nowStr(), ...meta });
}
```

- [ ] **Step 2: Geef metadata mee bij alle mails aan klanten**

In `js/app-bedrijf.js`, `zetStatus` (rond regel 237):

```js
  sendMail(store, klant.email, `Afspraak ${STATUS_LABELS[to].toLowerCase()}`,
    `Beste ${klant.name},\n\nJe afspraak bij ${bedrijf().name} (${cal.name}) van ${fmtDT(appt.startsAt)} heeft nu de status: ${STATUS_LABELS[to]}.`,
    { companyId: bedrijf().id, customerId: klant.id });
```

In `js/app-bedrijf.js`, `verstuurFactuur` (rond regel 309):

```js
  sendMail(store, ontvanger.email, `Factuur ${nummer} van ${b.name}`, body,
    { companyId: b.id, customerId: ontvanger.id });
```

In `js/app-bedrijf.js`, de creditnota-handler (rond regel 467):

```js
        sendMail(store, ontvanger.email, `Creditnota ${nummer} (bij factuur ${inv.number})`,
          `Beste ${ontvanger.name},\n\nHierbij creditnota ${nummer} van ${bedrijf().name} voor factuur ${inv.number}: ${euro(nota.totals.inclCents)}.`,
          { companyId: currentCompanyId, customerId: ontvanger.id });
```

In `js/app-admin.js`, de afspraakherinnering in "Simuleer dagelijkse taken" (rond regel 190):

```js
      sendMail(store, klant.email, 'Herinnering: je afspraak morgen',
        `Beste ${klant.name},\n\nHerinnering: je afspraak bij ${b.name} (${cal.name}) op ${fmtDT(a.startsAt)}.`,
        { companyId: b.id, customerId: klant.id });
```

In `js/app-admin.js`, de betalingsherinnering (rond regel 198) — alleen metadata als de ontvanger een klant is:

```js
      sendMail(store, ontvanger.email, `Betalingsherinnering factuur ${inv.number}`,
        `Beste ${ontvanger.name},\n\nFactuur ${inv.number} staat nog open (vervallen op ${inv.dueAt}).\nBetaal online: betaal.html?invoice=${inv.id}`,
        inv.recipientType === 'customer'
          ? { companyId: inv.issuerCompanyId, customerId: inv.recipientId } : {});
```

- [ ] **Step 3: Draai de tests (regressie)**

Run: `node tests/run.mjs`
Expected: `0 gefaald`.

- [ ] **Step 4: Commit**

```bash
git add js/ui.js js/app-bedrijf.js js/app-admin.js
git commit -m "feat: mails aan klanten dragen companyId/customerId-metadata"
```

---

### Task 5: Klantpagina per bedrijf — skelet, branding en neutrale pagina

**Files:**
- Modify: `index.html` (volledig vervangen)
- Modify: `js/app-klant.js` (volledig vervangen; boeken/toegang/mijn volgen in Taak 6–8)

**Interfaces:**
- Consumes: `store.companies` met `publicId` (Taak 3).
- Produces: module-globalen `store`, `company` (bedrijf uit `?bedrijf=`, alleen indien goedgekeurd), `tab`, en `renderAll()` die per tab de juiste secties toont. Taak 6–8 vullen de lege functies `renderAgendaKeuze()`, `renderBoeken()`, `renderMijn()` in.

- [ ] **Step 1: Vervang `index.html` volledig**

```html
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Afspraken</title><link rel="stylesheet" href="css/style.css"></head>
<body>
<header id="brand"></header>
<main>
  <section id="intro" class="card" hidden></section>
  <div id="tabs" class="regel-rij" hidden>
    <button class="btn" id="tab-boeken">Boeken</button>
    <button class="btn btn-secondary" id="tab-mijn">Mijn afspraken &amp; berichten</button>
  </div>
  <section id="boeken-agendas" class="card" hidden></section>
  <section id="boeken" class="card" hidden></section>
  <section id="mijn" class="card" hidden></section>
</main>
<aside id="mailbox" class="card"></aside>
<script type="module" src="js/app-klant.js"></script>
</body>
</html>
```

- [ ] **Step 2: Vervang `js/app-klant.js` volledig door het skelet**

```js
import { initStore, nowStr, todayStr, euro, fmtDT, el, esc, sendMail, renderMailbox, openInvoiceView } from './ui.js';
import { slotsForDay, addMinutes } from './logic/slots.js';
import { canTransition, STATUS_LABELS } from './logic/status.js';
import { shiftDays } from './logic/reminders.js';
import {
  validateKlantGegevens, normalizePhone, findCustomer,
  checkAccessCode, CODE_GELDIG_MINUTEN,
} from './logic/klant-toegang.js';

const store = initStore();
const publicId = new URLSearchParams(location.search).get('bedrijf');
const company = store.companies.where(c => c.publicId === publicId && c.approvedAt)[0] || null;

let tab = 'boeken'; // 'boeken' | 'mijn'
let selCalendarId = null;
let weekStart = mondayOf(todayStr());
let boekSlot = null;      // { cal, slot } in afwachting van klantgegevens
let toegangCodeId = null; // accessCodes-record in afwachting van code-invoer

function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00');
  const diff = (d.getDay() + 6) % 7; // ma=0
  return shiftDays(dateStr, -diff);
}

// ---------- sessie (code-verificatie geeft toegang per bedrijf) ----------
const SESSIE_KEY = 'akp-klant-sessie';

function sessieKlant() {
  if (!company) return null;
  try {
    const s = JSON.parse(window.sessionStorage.getItem(SESSIE_KEY));
    if (s && s.companyId === company.id) return store.customers.get(s.customerId) || null;
  } catch { /* geen of onleesbare sessie */ }
  return null;
}
function startSessie(customerId) {
  window.sessionStorage.setItem(SESSIE_KEY, JSON.stringify({ companyId: company.id, customerId }));
}
function stopSessie() {
  window.sessionStorage.removeItem(SESSIE_KEY);
}

// ---------- branding en neutrale pagina ----------
function renderBrand() {
  const kop = document.getElementById('brand');
  kop.innerHTML = '';
  if (!company) {
    kop.appendChild(el('<strong>Afspraken &amp; Kassa</strong>'));
    return;
  }
  if (company.logoDataUrl) kop.appendChild(el(`<img class="logo" src="${company.logoDataUrl}" alt="logo">`));
  kop.appendChild(el(`<strong>${esc(company.name)}</strong>`));
}

function renderIntro() {
  const box = document.getElementById('intro');
  box.hidden = false;
  box.innerHTML = '';
  box.appendChild(el('<h2>Geen bedrijfspagina gevonden</h2>'));
  box.appendChild(el(`<p>Deze pagina hoort bij één bedrijf en heeft een geldige
    bedrijfslink nodig (<code>?bedrijf=…</code>). Vraag je bedrijf om de juiste link,
    of kies hieronder een demo-bedrijf.</p>`));
  for (const b of store.companies.where(c => c.approvedAt)) {
    box.appendChild(el(`<p><a class="btn" href="index.html?bedrijf=${esc(b.publicId)}">${esc(b.name)}</a></p>`));
  }
}

// ---------- hoofdweergave ----------
function renderAll() {
  renderBrand();
  if (!company) { renderIntro(); renderMailbox(store, document.getElementById('mailbox')); return; }
  const tabs = document.getElementById('tabs');
  tabs.hidden = false;
  document.getElementById('tab-boeken').className = tab === 'boeken' ? 'btn' : 'btn btn-secondary';
  document.getElementById('tab-mijn').className = tab === 'mijn' ? 'btn' : 'btn btn-secondary';
  document.getElementById('boeken-agendas').hidden = tab !== 'boeken';
  document.getElementById('boeken').hidden = tab !== 'boeken' || !selCalendarId;
  document.getElementById('mijn').hidden = tab !== 'mijn';
  if (tab === 'boeken') { renderAgendaKeuze(); renderBoeken(); } else { renderMijn(); }
  renderMailbox(store, document.getElementById('mailbox'));
}

// Ingevuld in vervolgstappen van het plan.
function renderAgendaKeuze() {}
function renderBoeken() {}
function renderMijn() {}

document.getElementById('tab-boeken').addEventListener('click', () => { tab = 'boeken'; renderAll(); });
document.getElementById('tab-mijn').addEventListener('click', () => { tab = 'mijn'; renderAll(); });

renderAll();
```

- [ ] **Step 3: Controleer in de browser**

Start de dev-server (of hergebruik een draaiende): `node dev-server.mjs`, open:
- `http://localhost:8000/index.html` → neutrale pagina met demo-knoppen "Salon Zonnig" en "Fysio Vitaal" (niet "Kapper Nieuw" — niet goedgekeurd).
- `http://localhost:8000/index.html?bedrijf=k7f3q9w2` → kop "Salon Zonnig", twee tabs zichtbaar, secties leeg.
- Console: geen errors.

- [ ] **Step 4: Draai de tests (regressie)**

Run: `node tests/run.mjs`
Expected: `0 gefaald`.

- [ ] **Step 5: Commit**

```bash
git add index.html js/app-klant.js
git commit -m "feat: klantpagina per bedrijf — skelet, branding en neutrale pagina"
```

---

### Task 6: Boeken als gast met formaatvalidatie

**Files:**
- Modify: `js/app-klant.js` (vervang de lege `renderAgendaKeuze` en `renderBoeken`)

**Interfaces:**
- Consumes: `slotsForDay`, `validateKlantGegevens`, `normalizePhone`, `findCustomer`, `sendMail(…, meta)`.
- Produces: werkende boekflow; klantrecords `{ companyId, name, email, phone, street: null, houseNumber: null, postalCode: null, city: null }`.

- [ ] **Step 1: Vervang `renderAgendaKeuze` en `renderBoeken` en voeg `renderBoekForm`/`boek` toe**

```js
function renderAgendaKeuze() {
  const box = document.getElementById('boeken-agendas');
  box.innerHTML = '';
  box.appendChild(el('<h2>Kies een agenda</h2>'));
  for (const cal of store.calendars.where(k => k.companyId === company.id && k.active)) {
    const btn = el(`<button class="btn ${selCalendarId === cal.id ? '' : 'btn-secondary'}">${esc(cal.name)} (${cal.slotMinutes} min)</button>`);
    btn.addEventListener('click', () => {
      selCalendarId = cal.id;
      weekStart = mondayOf(todayStr());
      boekSlot = null;
      renderAll();
    });
    box.appendChild(btn);
  }
}

function renderBoeken() {
  const box = document.getElementById('boeken');
  if (!selCalendarId) return;
  const cal = store.calendars.get(selCalendarId);
  box.innerHTML = '';
  box.appendChild(el(`<h2>Boeken: ${esc(cal.name)}</h2>`));

  const thisMonday = mondayOf(todayStr());
  const nav = el(`<div class="week-nav">
    <button class="btn btn-secondary" id="vorige" ${weekStart <= thisMonday ? 'disabled' : ''}>‹ vorige</button>
    <strong>Week van ${esc(weekStart)}</strong>
    <button class="btn btn-secondary" id="volgende">volgende ›</button>
  </div>`);
  nav.querySelector('#vorige').addEventListener('click', () => { weekStart = shiftDays(weekStart, -7); boekSlot = null; renderAll(); });
  nav.querySelector('#volgende').addEventListener('click', () => { weekStart = shiftDays(weekStart, 7); boekSlot = null; renderAll(); });
  box.appendChild(nav);

  const hours = store.openingHours.where(h => h.calendarId === cal.id);
  const blocks = store.blocks.where(b => b.calendarId === cal.id);
  const dagen = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

  for (let i = 0; i < 7; i++) {
    const dateStr = shiftDays(weekStart, i);
    const appts = store.appointments.where(a => a.calendarId === cal.id && a.startsAt.startsWith(dateStr));
    const slots = slotsForDay({
      dateStr, openingHours: hours, slotMinutes: cal.slotMinutes,
      appointments: appts, blocks, now: nowStr(),
    });
    const dag = el(`<div class="dag"><h4>${dagen[i]} ${esc(dateStr)}</h4></div>`);
    if (!slots.length) dag.appendChild(el('<em>Geen sloten</em>'));
    for (const s of slots) {
      const tijd = s.startsAt.slice(11);
      if (!s.free) {
        dag.appendChild(el(`<span class="slot bezet">${tijd}</span>`));
      } else {
        const btn = el(`<button class="slot">${tijd}</button>`);
        btn.addEventListener('click', () => { boekSlot = { cal, slot: s }; renderAll(); });
        dag.appendChild(btn);
      }
    }
    box.appendChild(dag);
  }

  if (boekSlot && boekSlot.cal.id === cal.id) box.appendChild(renderBoekForm());
}

function renderBoekForm() {
  const { cal, slot } = boekSlot;
  const sessie = sessieKlant();
  const kaart = el(`<div class="card"><h3>Afspraak op ${fmtDT(slot.startsAt)}</h3>
    <p>Vul je gegevens in. We controleren alleen of ze er geldig uitzien; je hoeft
    niets te bevestigen.</p>
    <form>
      <label>Naam</label><input name="name" value="${sessie ? esc(sessie.name) : ''}" required>
      <label>E-mail</label><input name="email" value="${sessie ? esc(sessie.email) : ''}" required>
      <label>Telefoonnummer</label><input name="phone" placeholder="06…" value="${sessie ? esc(sessie.phone) : ''}" required>
      <p class="fout banner banner-error" hidden></p>
      <button class="btn" type="submit">Boek deze afspraak</button>
      <button class="btn btn-secondary" type="button" id="annuleer">Annuleren</button>
    </form></div>`);
  kaart.querySelector('#annuleer').addEventListener('click', () => { boekSlot = null; renderAll(); });
  kaart.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const invoer = { name: f.get('name'), email: f.get('email'), phone: f.get('phone') };
    const r = validateKlantGegevens(invoer);
    const foutEl = kaart.querySelector('.fout');
    if (!r.ok) {
      foutEl.textContent = Object.values(r.errors).join(' ');
      foutEl.hidden = false;
      return;
    }
    boek(cal, slot, invoer);
  });
  return kaart;
}

function boek(cal, slot, invoer) {
  // race-simulatie: is het slot nog vrij? (in Laravel dwingt de unieke index dit af)
  const bezet = store.appointments.where(a =>
    a.calendarId === cal.id && a.startsAt === slot.startsAt && a.status !== 'cancelled').length > 0;
  if (bezet) { alert('Dit slot is zojuist bezet.'); boekSlot = null; renderAll(); return; }

  const telefoon = normalizePhone(invoer.phone);
  let klant = findCustomer(store.customers.all(), company.id, invoer.email, invoer.phone);
  if (klant) {
    klant = store.customers.update(klant.id, {
      name: invoer.name.trim(), email: invoer.email.trim(), phone: telefoon,
    });
  } else {
    klant = store.customers.create({
      companyId: company.id, name: invoer.name.trim(), email: invoer.email.trim(),
      phone: telefoon, street: null, houseNumber: null, postalCode: null, city: null,
    });
  }
  store.appointments.create({
    calendarId: cal.id, customerId: klant.id,
    startsAt: slot.startsAt, endsAt: slot.endsAt, status: 'scheduled',
    reminderSentAt: null, cancelledAt: null, completedAt: null, noShowAt: null,
  });
  sendMail(store, klant.email, 'Afspraak bevestigd',
    `Beste ${klant.name},\n\nJe afspraak bij ${company.name} (${cal.name}) op ${fmtDT(slot.startsAt)} is bevestigd.`,
    { companyId: company.id, customerId: klant.id });
  sendMail(store, company.email, 'Nieuwe afspraak',
    `${klant.name} heeft geboekt: ${cal.name}, ${fmtDT(slot.startsAt)}.`);
  boekSlot = null;
  alert(`Je afspraak op ${fmtDT(slot.startsAt)} staat vast. Een bevestiging is per e-mail verstuurd (zie postvak-simulatie).`);
  renderAll();
}
```

- [ ] **Step 2: Controleer in de browser**

Op `index.html?bedrijf=k7f3q9w2`:
- Kies "Stoel 1", klik een vrij slot → formulier verschijnt.
- Verstuur met telefoon `123` → foutmelding over het telefoonnummer, geen afspraak.
- Vul `Test Klant` / `test@example.com` / `0611122233` in → boekt; slot wordt bezet; bevestiging in het postvak.
- Boek nogmaals met hetzelfde e-mailadres maar naam `Test Klant 2` → er ontstaat géén tweede klantrecord (controleer via bedrijfsportaal-facturen-klantkeuze of `JSON.parse(localStorage.getItem('akp-data-v2')).customers` in de console) en de naam is bijgewerkt.

- [ ] **Step 3: Draai de tests (regressie)**

Run: `node tests/run.mjs`
Expected: `0 gefaald`.

- [ ] **Step 4: Commit**

```bash
git add js/app-klant.js
git commit -m "feat: gast-boeken met formaatvalidatie en klant-matching per bedrijf"
```

---

### Task 7: Code-verificatie en "Mijn afspraken & berichten"

**Files:**
- Modify: `js/app-klant.js` (vervang de lege `renderMijn`)

**Interfaces:**
- Consumes: `findCustomer`, `checkAccessCode`, `CODE_GELDIG_MINUTEN`, `addMinutes`, `canTransition`, `openInvoiceView`, sessiehelpers uit Taak 5, mail-metadata uit Taak 4.
- Produces: complete beheerflow achter code-verificatie.

- [ ] **Step 1: Vervang `renderMijn` en voeg de deelfuncties toe**

```js
function renderMijn() {
  const box = document.getElementById('mijn');
  box.innerHTML = '';
  const klant = sessieKlant();
  if (!klant) { renderToegang(box); return; }

  const kop = el(`<div class="regel-rij"><p>Je bekijkt de gegevens van
    <strong>${esc(klant.name)}</strong> bij ${esc(company.name)}.</p>
    <button class="btn btn-secondary" id="uitloggen">Sluit toegang</button></div>`);
  kop.querySelector('#uitloggen').addEventListener('click', () => { stopSessie(); renderAll(); });
  box.appendChild(kop);
  renderMijnAfspraken(box, klant);
  renderMijnBerichten(box, klant);
  renderMijnFacturen(box, klant);
}

// ---------- toegang via code ----------
function renderToegang(box) {
  box.appendChild(el('<h2>Mijn afspraken &amp; berichten</h2>'));
  box.appendChild(el(`<p>Om je afspraken te beheren of berichten te lezen controleren we
    eerst dat jij het bent: vul je e-mailadres óf telefoonnummer in, dan sturen we
    een code.</p>`));

  const vraag = el(`<form class="regel-rij">
    <input name="contact" placeholder="E-mailadres of telefoonnummer" required>
    <button class="btn" type="submit">Stuur code</button>
  </form>`);
  const uitleg = el('<div></div>');
  vraag.addEventListener('submit', e => {
    e.preventDefault();
    const invoer = String(new FormData(vraag).get('contact')).trim();
    const viaMail = invoer.includes('@');
    const klant = viaMail
      ? findCustomer(store.customers.all(), company.id, invoer, '')
      : findCustomer(store.customers.all(), company.id, '', invoer);
    uitleg.innerHTML = '';
    if (!klant) {
      uitleg.appendChild(el(`<div class="banner banner-error">We kennen dit
        ${viaMail ? 'e-mailadres' : 'telefoonnummer'} niet bij ${esc(company.name)}.</div>`));
      return;
    }
    const code = String(Math.floor(Math.random() * 900000 + 100000));
    const rec = store.accessCodes.create({
      companyId: company.id, customerId: klant.id, channel: viaMail ? 'email' : 'sms',
      code, expiresAt: addMinutes(nowStr(), CODE_GELDIG_MINUTEN), attempts: 0,
    });
    toegangCodeId = rec.id;
    if (viaMail) {
      sendMail(store, klant.email, `Je toegangscode voor ${company.name}`,
        `Beste ${klant.name},\n\nJe toegangscode is: ${code}\nDe code is ${CODE_GELDIG_MINUTEN} minuten geldig.`,
        { companyId: company.id, customerId: klant.id });
    }
    uitleg.appendChild(el(`<p>${viaMail ? 'E-mail' : 'SMS'}-code (simulatie):
      <strong>${esc(code)}</strong></p>`));
    const codeForm = el(`<form class="regel-rij">
      <input name="code" placeholder="Voer de code in" required>
      <button class="btn" type="submit">Bevestig</button>
      <span class="fout"></span>
    </form>`);
    codeForm.addEventListener('submit', ev => {
      ev.preventDefault();
      const codeRec = store.accessCodes.get(toegangCodeId);
      const r = checkAccessCode(codeRec, new FormData(codeForm).get('code'), nowStr());
      if (!r.ok) {
        if (r.telPoging) store.accessCodes.update(codeRec.id, { attempts: codeRec.attempts + 1 });
        codeForm.querySelector('.fout').textContent = r.reason;
        return;
      }
      store.accessCodes.remove(codeRec.id);
      toegangCodeId = null;
      startSessie(codeRec.customerId);
      renderAll();
    });
    uitleg.appendChild(codeForm);
  });
  box.appendChild(vraag);
  box.appendChild(uitleg);
}

// ---------- afspraken ----------
function renderMijnAfspraken(box, klant) {
  box.appendChild(el('<h3>Afspraken</h3>'));
  const eigen = store.appointments.where(a => a.customerId === klant.id)
    .sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));
  if (!eigen.length) { box.appendChild(el('<p>Nog geen afspraken.</p>')); return; }
  const table = el('<table><thead><tr><th>Agenda</th><th>Wanneer</th><th>Status</th><th></th></tr></thead><tbody></tbody></table>');
  const tbody = table.querySelector('tbody');
  for (const a of eigen) {
    const cal = store.calendars.get(a.calendarId);
    const tr = el(`<tr><td>${esc(cal.name)}</td><td>${fmtDT(a.startsAt)}</td>
      <td><span class="badge status-${a.status}">${STATUS_LABELS[a.status]}</span></td><td></td></tr>`);
    if (a.status === 'scheduled') {
      const btn = el('<button class="btn btn-danger">Afzeggen</button>');
      btn.addEventListener('click', () => {
        const r = canTransition(a, 'cancelled', 'customer', nowStr(), company.cancelHours);
        if (!r.ok) { alert(r.reason); return; }
        if (!confirm(`Afspraak van ${fmtDT(a.startsAt)} afzeggen? Een nieuwe boek je via de tab Boeken.`)) return;
        store.appointments.update(a.id, { status: 'cancelled', cancelledAt: nowStr() });
        sendMail(store, company.email, 'Afspraak afgezegd',
          `${klant.name} heeft de afspraak van ${fmtDT(a.startsAt)} (${cal.name}) afgezegd.`);
        renderAll();
      });
      tr.lastElementChild.appendChild(btn);
    }
    tbody.appendChild(tr);
  }
  box.appendChild(table);
}

// ---------- berichten ----------
function renderMijnBerichten(box, klant) {
  box.appendChild(el('<h3>Berichten</h3>'));
  const berichten = store.mails.where(m => m.companyId === company.id && m.customerId === klant.id)
    .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  if (!berichten.length) { box.appendChild(el('<p>Nog geen berichten.</p>')); return; }
  for (const m of berichten) {
    box.appendChild(el(`<details class="mail">
      <summary>${esc(m.sentAt.replace('T', ' '))} — <strong>${esc(m.subject)}</strong></summary>
      <pre>${esc(m.body)}</pre>
    </details>`));
  }
}

// ---------- facturen ----------
function renderMijnFacturen(box, klant) {
  box.appendChild(el('<h3>Facturen</h3>'));
  const eigen = store.invoices.where(i => i.issuerCompanyId === company.id &&
    i.recipientType === 'customer' && i.recipientId === klant.id && i.status !== 'draft');
  if (!eigen.length) { box.appendChild(el('<p>Nog geen facturen.</p>')); return; }
  const table = el('<table><thead><tr><th>Nummer</th><th>Bedrag</th><th>Status</th><th></th></tr></thead><tbody></tbody></table>');
  const tbody = table.querySelector('tbody');
  for (const inv of eigen) {
    const statusTekst = { sent: 'Openstaand', paid: 'Betaald', cancelled: 'Geannuleerd' }[inv.status] || inv.status;
    const tr = el(`<tr><td>${esc(inv.number)}</td><td>${euro(inv.totals.inclCents)}</td>
      <td>${esc(statusTekst)}</td><td></td></tr>`);
    const cell = tr.lastElementChild;
    if (inv.status === 'sent' && company.mollieLinked) {
      cell.appendChild(el(`<a class="btn" href="betaal.html?invoice=${inv.id}">Betalen</a>`));
    }
    const bekijk = el('<button class="btn btn-secondary">Bekijk</button>');
    bekijk.addEventListener('click', () => openInvoiceView(store, inv));
    cell.appendChild(bekijk);
    tbody.appendChild(tr);
  }
  box.appendChild(table);
}
```

- [ ] **Step 2: Controleer in de browser**

Op `index.html?bedrijf=k7f3q9w2`, tab "Mijn afspraken & berichten":
- Onbekend adres `x@y.nl` → nette foutmelding.
- `anna@example.com` → code verschijnt; verkeerde code 3× → melding pogingenlimiet; "Stuur code" opnieuw → juiste code → overzicht van Anna's salon-afspraken (níet haar fysio-afspraken), berichten en de betaalde salon-factuur.
- Telefoonnummer `06 76 54 32 10` (Bram, salon) → code-flow werkt ook via telefoon.
- Afzeggen van de geplande afspraak binnen de termijn → status wordt Afgezegd; buiten de termijn (afspraak < 24 uur vooruit boeken en direct afzeggen) → nette weigering.
- "Sluit toegang" → terug naar het code-formulier. Open ook `index.html?bedrijf=p2m8x4r6` in dezelfde tab: de salon-sessie geeft daar géén toegang.

- [ ] **Step 3: Draai de tests (regressie)**

Run: `node tests/run.mjs`
Expected: `0 gefaald`.

- [ ] **Step 4: Commit**

```bash
git add js/app-klant.js
git commit -m "feat: code-verificatie en mijn-afspraken/berichten/facturen per bedrijf"
```

---

### Task 8: Bedrijfsportaal — publiek ID, deep-link, embed-fragment en eigen klanten

**Files:**
- Modify: `js/app-bedrijf.js`
- Modify: `bedrijf.html` (geen wijziging nodig aan de structuur; alleen controleren)

**Interfaces:**
- Consumes: `makePublicId` uit `js/logic/klant-toegang.js`.
- Produces: bedrijfsregistratie met `publicId`; `bedrijf.html?bedrijf=<publicId>` selecteert dat bedrijf; instellingenblok toont klantpagina-link + iframe-fragment; factuur-editor toont alleen eigen klanten.

- [ ] **Step 1: Importeer `makePublicId` en geef nieuw geregistreerde bedrijven een publiek ID**

Bovenaan `js/app-bedrijf.js` toevoegen:

```js
import { makePublicId } from './logic/klant-toegang.js';
```

In de registratie-handler (`maak`, rond regel 67) het create-object uitbreiden:

```js
        const rec = store.companies.create({
          name: f.get('name'), publicId: makePublicId(), street: f.get('street'), houseNumber: f.get('houseNumber'),
          postalCode: f.get('postalCode'), city: f.get('city'), phone: f.get('phone'),
          email: f.get('email'), kvk: f.get('kvk'), logoDataUrl,
          emailVerified: false, phoneVerified: false, approvedAt: null,
          rejectedReason: null, mollieLinked: false, cancelHours: 24, smsCode,
        });
```

- [ ] **Step 2: Deep-link `?bedrijf=<publicId>` bij initialisatie**

Onderaan `js/app-bedrijf.js`, vlak vóór `rebuildPicker();`:

```js
const urlPublicId = new URLSearchParams(location.search).get('bedrijf');
if (urlPublicId) {
  const gekozen = store.companies.where(c => c.publicId === urlPublicId)[0];
  if (gekozen) window.localStorage.setItem('akp-bedrijf', String(gekozen.id));
}
```

(`rebuildPicker` leest `akp-bedrijf` en selecteert dan dit bedrijf.)

- [ ] **Step 3: Klantpagina-link en embed-fragment in de instellingen**

In `renderAgendas`, direct na het bestaande instellingenblok (`box.appendChild(inst);`, rond regel 146):

```js
  const klantUrl = new URL(`index.html?bedrijf=${b.publicId}`, location.href).href;
  const embedCode = `<iframe src="${klantUrl}" style="width:100%;height:900px;border:0" title="Afspraken ${b.name}"></iframe>`;
  const embed = el(`<div class="card"><h3>Jouw klantpagina</h3>
    <p><a href="${esc(klantUrl)}" target="_blank">${esc(klantUrl)}</a></p>
    <p>Zet de klantpagina in je eigen website met dit fragment:</p>
    <textarea readonly rows="3" style="width:100%">${esc(embedCode)}</textarea>
    <button class="btn btn-secondary" type="button">Kopieer fragment</button></div>`);
  embed.querySelector('button').addEventListener('click', () => {
    navigator.clipboard.writeText(embedCode);
  });
  box.appendChild(embed);
```

- [ ] **Step 4: Factuur-editor toont alleen eigen klanten**

In `renderFacturen` (rond regel 323) de klantkeuze beperken tot het eigen bedrijf:

```js
  const klantSel = el(`<select><option value="">— kies klant —</option>
    ${store.customers.where(c => c.companyId === currentCompanyId).map(c =>
      `<option value="${c.id}" ${editor.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
  </select>`);
```

- [ ] **Step 5: Controleer in de browser**

- `bedrijf.html?bedrijf=k7f3q9w2` → Salon Zonnig staat direct geselecteerd.
- Instellingen tonen de klantpagina-link en het iframe-fragment; de link opent de gebrande klantpagina.
- Factuur-editor: klantkeuze bevat alleen salon-klanten (Anna, Bram, Carla — niet de fysio-records).
- Registreer een nieuw bedrijf → in de console heeft het record een `publicId` van 8 tekens.

- [ ] **Step 6: Draai de tests (regressie) en commit**

Run: `node tests/run.mjs` — Expected: `0 gefaald`.

```bash
git add js/app-bedrijf.js
git commit -m "feat: bedrijfsportaal met publiek ID, deep-link en embed-fragment"
```

---

### Task 9: Betaalpagina — terug naar de bedrijfspagina

**Files:**
- Modify: `js/app-betaal.js`

**Interfaces:**
- Consumes: `company.publicId` via `inv.issuerCompanyId`.
- Produces: "Annuleren"- en "Terug"-links wijzen naar `index.html?bedrijf=<publicId>` wanneer de ontvanger een klant is; anders naar `bedrijf.html`.

- [ ] **Step 1: Bepaal de terug-URL en gebruik die in beide links**

Vervang in `js/app-betaal.js` het `else`-blok (regel 14-32) door:

```js
} else {
  const afzenderBedrijf = inv.issuerCompanyId ? store.companies.get(inv.issuerCompanyId) : null;
  const terugUrl = inv.recipientType === 'customer' && afzenderBedrijf
    ? `index.html?bedrijf=${afzenderBedrijf.publicId}` : 'bedrijf.html';
  box.innerHTML = `<h1>Betaal ${euro(inv.totals.inclCents)}</h1>
    <p>Factuur ${esc(inv.number)}</p>
    <button class="btn" id="pay">iDEAL — Betaal nu (simulatie)</button>
    <a href="${esc(terugUrl)}">Annuleren</a>`;
  document.getElementById('pay').addEventListener('click', () => {
    store.invoices.update(inv.id, { status: 'paid', paidAt: nowStr() });
    const ontvanger = inv.recipientType === 'customer'
      ? store.customers.get(inv.recipientId) : store.companies.get(inv.recipientId);
    const afzender = afzenderBedrijf || { name: 'Platform', email: 'platform@example.com' };
    sendMail(store, ontvanger.email, `Betaling ontvangen: ${inv.number}`,
      `Bedankt, ${euro(inv.totals.inclCents)} is voldaan.`,
      inv.recipientType === 'customer'
        ? { companyId: inv.issuerCompanyId, customerId: ontvanger.id } : {});
    sendMail(store, afzender.email, `Factuur ${inv.number} is betaald`,
      `Ontvangen van ${ontvanger.name}.`);
    box.innerHTML = `<h1>✅ Betaald</h1><p><a href="${esc(terugUrl)}">Terug</a></p>`;
  });
}
```

(De `sendMail`-metadata voor de betaalbevestiging — zie Taak 4 voor het patroon — zit in dit blok inbegrepen.)

- [ ] **Step 2: Controleer in de browser**

Betaal de openstaande fysio-factuur via de klantpagina van Fysio Vitaal — Fysio heeft géén Mollie, dus gebruik de salon: maak in het bedrijfsportaal een factuur voor Anna (salon), verstuur, en betaal via "Mijn facturen" op `index.html?bedrijf=k7f3q9w2`. De "Terug"-link brengt je terug op de salon-klantpagina; het bericht "Betaling ontvangen" staat daarna in Anna's berichten.

- [ ] **Step 3: Draai de tests (regressie) en commit**

Run: `node tests/run.mjs` — Expected: `0 gefaald`.

```bash
git add js/app-betaal.js
git commit -m "feat: betaalpagina keert terug naar de bedrijfsgebonden klantpagina"
```

---

### Task 10: README en demo-script bijwerken

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Werk het demo-script en de beperkingen bij**

Vervang de secties "Demo-script" en "Beperkingen van het prototype" door:

```markdown
## Demo-script
1. **Klant** (`index.html?bedrijf=k7f3q9w2` — Salon Zonnig): kies een agenda en een
   vrij slot, vul naam/e-mail/telefoon in (alleen formaatcontrole) en boek.
   De bevestiging verschijnt in het postvak-paneel.
2. **Klant — beheren**: open de tab "Mijn afspraken & berichten", vul
   `anna@example.com` of `06 87 65 43 21` in, voer de getoonde code in en bekijk
   afspraken, berichten en facturen. Zeg de geplande afspraak af.
3. **Bedrijf** (`bedrijf.html?bedrijf=k7f3q9w2`): zet een afspraak op Voltooid,
   klik "→ Factuur maken", vul een regel in en verstuur. Bekijk onder
   "Agenda's en instellingen" ook jouw klantpagina-link en het iframe-fragment
   om de pagina in je eigen website te zetten.
4. **Klant**: haal de factuur op via "Mijn afspraken & berichten" → Betalen →
   nep-Mollie-pagina → betaald.
5. **Admin** (`admin.html`): keur "Kapper Nieuw" goed of af, stuur een
   platformfactuur, klik "▶ Simuleer dagelijkse taken" en bekijk de rapportages.
   "↺ Reset demo-data" zet alles terug.

Demo-bedrijfslinks: Salon Zonnig `?bedrijf=k7f3q9w2`, Fysio Vitaal `?bedrijf=p2m8x4r6`.
`index.html` zonder bedrijfslink toont een uitlegpagina met deze demo-links.

## Beperkingen van het prototype
- Klanten hebben geen account: boeken is een gastformulier met formaatvalidatie;
  beheer en berichten zitten achter een code via e-mail of SMS (op het scherm
  gesimuleerd). Bedrijfs-"login" is nog een kiezer in het bedrijfsportaal.
- E-mail, SMS en Mollie zijn zichtbare simulaties (postvak-paneel, code op
  het scherm, nep-betaalpagina); er wordt niets echt verstuurd of afgeschreven.
- Het postvak-paneel toont álle gesimuleerde mail (van alle bedrijven) — het is
  demo-gereedschap, geen onderdeel van het product.
- Het logo wordt niet echt herschaald naar 300×300 (alleen zo weergegeven).
- De factuur-"PDF" is een printbare HTML-weergave.
- Data staat in localStorage: per browser, per apparaat.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: demo-script en beperkingen bijgewerkt op klantpagina's per bedrijf"
```

---

### Task 11: Eindverificatie

- [ ] **Step 1: Volledige testrun**

Run: `node tests/run.mjs`
Expected: alle tests geslaagd, `0 gefaald`, exitcode 0.

- [ ] **Step 2: Doorloop het volledige demo-script in de browser**

Met een verse browserstate (localStorage leeg of "Reset demo-data"): voer stap 1 t/m 5
van het nieuwe README-demo-script uit en controleer de console op errors. Controleer
daarnaast expliciet de spec-eisen:
- `index.html` zonder `?bedrijf=` → neutrale uitlegpagina.
- Klantpagina toont logo (indien gezet) en bedrijfsnaam, geen platformnavigatie.
- Een klant met sessie bij Salon ziet níets van Fysio (en omgekeerd).
- Iframe-check: maak tijdelijk een `embed-test.html` naast `index.html` met alleen het
  gekopieerde iframe-fragment erin, open het via de dev-server en controleer dat de
  klantpagina in het frame laadt en bruikbaar is. Verwijder het bestand daarna weer
  (niet committen).

- [ ] **Step 3: Rond af**

Los gevonden problemen op (kleine fixes direct committen als `fix:`). Meld daarna dat
de implementatie klaar is voor review.
