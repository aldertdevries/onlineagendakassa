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

document.getElementById('tab-boeken').addEventListener('click', () => { tab = 'boeken'; renderAll(); });
document.getElementById('tab-mijn').addEventListener('click', () => { tab = 'mijn'; renderAll(); });

renderAll();
