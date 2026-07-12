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

function renderMijn() {}

document.getElementById('tab-boeken').addEventListener('click', () => { tab = 'boeken'; renderAll(); });
document.getElementById('tab-mijn').addEventListener('click', () => { tab = 'mijn'; renderAll(); });

renderAll();
