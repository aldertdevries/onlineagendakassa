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
