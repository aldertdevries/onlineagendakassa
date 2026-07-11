import { initStore, nowStr, todayStr, euro, fmtDT, el, esc, sendMail, renderMailbox, userPicker, openInvoiceView } from './ui.js';
import { slotsForDay, addMinutes } from './logic/slots.js';
import { canTransition, STATUS_LABELS } from './logic/status.js';
import { shiftDays } from './logic/reminders.js';

const store = initStore();
let currentCustomerId = null;
let selCalendarId = null;
let weekStart = mondayOf(todayStr());

function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00');
  const diff = (d.getDay() + 6) % 7; // ma=0
  return shiftDays(dateStr, -diff);
}

function currentCustomer() {
  return currentCustomerId ? store.customers.get(currentCustomerId) : null;
}

function isVerified(c) {
  return c && c.emailVerified && c.phoneVerified;
}

function refreshMailbox() {
  renderMailbox(store, document.getElementById('mailbox'));
}

function renderAll() {
  renderRegistratie();
  renderBedrijven();
  renderBoeken();
  renderMijnAfspraken();
  renderMijnFacturen();
  refreshMailbox();
}

// ---------- registratie ----------
function renderRegistratie() {
  const box = document.getElementById('registratie');
  box.innerHTML = '';
  const c = currentCustomer();

  if (!c) {
    box.appendChild(el('<h2>Nieuwe klant? Registreer je</h2>'));
    const form = el(`<form>
      <label>Naam</label><input name="name" required>
      <label>Straat</label><input name="street" required>
      <label>Huisnummer</label><input name="houseNumber" required>
      <label>Postcode</label><input name="postalCode" required>
      <label>Plaats</label><input name="city" required>
      <label>WhatsApp-telefoonnummer</label><input name="phone" placeholder="+316..." required>
      <label>E-mail</label><input name="email" type="email" required>
      <button class="btn" type="submit">Registreren</button>
    </form>`);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(form);
      const smsCode = String(Math.floor(Math.random() * 900000 + 100000));
      const rec = store.customers.create({
        name: f.get('name'), street: f.get('street'), houseNumber: f.get('houseNumber'),
        postalCode: f.get('postalCode'), city: f.get('city'), phone: f.get('phone'),
        email: f.get('email'), emailVerified: false, phoneVerified: false, smsCode,
      });
      sendMail(store, rec.email, 'Bevestig je e-mailadres',
        `Beste ${rec.name},\n\nKlik op de link om je e-mailadres te bevestigen.\n(Simulatie: gebruik de knop in het klantportaal.)`);
      window.localStorage.setItem('akp-klant', String(rec.id));
      currentCustomerId = rec.id;
      rebuildPicker();
      renderAll();
    });
    box.appendChild(form);
    return;
  }

  if (isVerified(c)) {
    box.appendChild(el(`<p>Ingelogd als <strong>${esc(c.name)}</strong> — volledig geverifieerd ✔</p>`));
    return;
  }

  box.appendChild(el('<h2>Verificatie afronden</h2>'));
  box.appendChild(el('<div class="banner banner-warn">Rond eerst je verificatie af voordat je kunt boeken.</div>'));

  if (!c.emailVerified) {
    const btn = el('<button class="btn">✔ Klik hier om de e-maillink te simuleren</button>');
    btn.addEventListener('click', () => {
      store.customers.update(c.id, { emailVerified: true });
      renderAll();
    });
    box.appendChild(el('<p>1. E-mail: er is een verificatiemail "verstuurd" (zie postvak).</p>'));
    box.appendChild(btn);
  } else {
    box.appendChild(el('<p>1. E-mail geverifieerd ✔</p>'));
  }

  if (!c.phoneVerified) {
    box.appendChild(el(`<p>2. SMS-code (simulatie): <strong>${esc(c.smsCode)}</strong></p>`));
    const form = el(`<form class="regel-rij"><input name="code" placeholder="Voer de code in">
      <button class="btn" type="submit">Verifieer telefoon</button></form>`);
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (new FormData(form).get('code') === c.smsCode) {
        store.customers.update(c.id, { phoneVerified: true });
        renderAll();
      } else {
        alert('Onjuiste code.');
      }
    });
    box.appendChild(form);
  } else {
    box.appendChild(el('<p>2. Telefoon geverifieerd ✔</p>'));
  }
}

// ---------- bedrijvenlijst ----------
function renderBedrijven() {
  const box = document.getElementById('bedrijven');
  box.innerHTML = '';
  box.appendChild(el('<h2>Bedrijven</h2>'));
  const verified = isVerified(currentCustomer());
  for (const b of store.companies.where(c => c.approvedAt)) {
    const kaart = el(`<div class="bedrijf-kaart">
      ${b.logoDataUrl ? `<img class="logo" src="${b.logoDataUrl}" alt="logo">` : '<div class="logo"></div>'}
      <div><strong>${esc(b.name)}</strong><br>${esc(b.city)}<div class="agenda-knoppen"></div></div>
    </div>`);
    const knoppen = kaart.querySelector('.agenda-knoppen');
    for (const cal of store.calendars.where(k => k.companyId === b.id && k.active)) {
      const btn = el(`<button class="btn" ${verified ? '' : 'disabled'}>Boek bij ${esc(cal.name)} (${cal.slotMinutes} min)</button>`);
      btn.addEventListener('click', () => {
        selCalendarId = cal.id;
        weekStart = mondayOf(todayStr());
        renderBoeken();
        document.getElementById('boeken').scrollIntoView({ behavior: 'smooth' });
      });
      knoppen.appendChild(btn);
    }
    box.appendChild(kaart);
  }
}

// ---------- boeken ----------
function renderBoeken() {
  const box = document.getElementById('boeken');
  if (!selCalendarId) { box.hidden = true; return; }
  const cal = store.calendars.get(selCalendarId);
  const bedrijf = store.companies.get(cal.companyId);
  box.hidden = false;
  box.innerHTML = '';
  box.appendChild(el(`<h2>Boeken: ${esc(bedrijf.name)} — ${esc(cal.name)}</h2>`));

  const thisMonday = mondayOf(todayStr());
  const nav = el(`<div class="week-nav">
    <button class="btn btn-secondary" id="vorige" ${weekStart <= thisMonday ? 'disabled' : ''}>‹ vorige</button>
    <strong>Week van ${esc(weekStart)}</strong>
    <button class="btn btn-secondary" id="volgende">volgende ›</button>
  </div>`);
  nav.querySelector('#vorige').addEventListener('click', () => { weekStart = shiftDays(weekStart, -7); renderBoeken(); });
  nav.querySelector('#volgende').addEventListener('click', () => { weekStart = shiftDays(weekStart, 7); renderBoeken(); });
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
        btn.addEventListener('click', () => boek(cal, bedrijf, s));
        dag.appendChild(btn);
      }
    }
    box.appendChild(dag);
  }
}

function boek(cal, bedrijf, slot) {
  const c = currentCustomer();
  if (!isVerified(c)) { alert('Rond eerst je verificatie af.'); return; }
  if (!confirm(`Afspraak boeken bij ${bedrijf.name} (${cal.name}) op ${fmtDT(slot.startsAt)}?`)) return;
  // race-simulatie: is het slot nog vrij? (in Laravel dwingt de unieke index dit af)
  const bezet = store.appointments.where(a =>
    a.calendarId === cal.id && a.startsAt === slot.startsAt && a.status !== 'cancelled').length > 0;
  if (bezet) { alert('Dit slot is zojuist bezet.'); renderBoeken(); return; }
  store.appointments.create({
    calendarId: cal.id, customerId: c.id,
    startsAt: slot.startsAt, endsAt: slot.endsAt, status: 'scheduled',
    reminderSentAt: null, cancelledAt: null, completedAt: null, noShowAt: null,
  });
  sendMail(store, c.email, 'Afspraak bevestigd',
    `Beste ${c.name},\n\nJe afspraak bij ${bedrijf.name} (${cal.name}) op ${fmtDT(slot.startsAt)} is bevestigd.`);
  sendMail(store, bedrijf.email, 'Nieuwe afspraak',
    `${c.name} heeft geboekt: ${cal.name}, ${fmtDT(slot.startsAt)}.`);
  renderAll();
}

// ---------- mijn afspraken ----------
function renderMijnAfspraken() {
  const box = document.getElementById('mijn-afspraken');
  box.innerHTML = '';
  const c = currentCustomer();
  if (!c) { box.hidden = true; return; }
  box.hidden = false;
  box.appendChild(el('<h2>Mijn afspraken</h2>'));
  const eigen = store.appointments.where(a => a.customerId === c.id)
    .sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));
  if (!eigen.length) { box.appendChild(el('<p>Nog geen afspraken.</p>')); return; }
  const table = el('<table><thead><tr><th>Bedrijf</th><th>Agenda</th><th>Wanneer</th><th>Status</th><th></th></tr></thead><tbody></tbody></table>');
  const tbody = table.querySelector('tbody');
  for (const a of eigen) {
    const cal = store.calendars.get(a.calendarId);
    const bedrijf = store.companies.get(cal.companyId);
    const tr = el(`<tr><td>${esc(bedrijf.name)}</td><td>${esc(cal.name)}</td>
      <td>${fmtDT(a.startsAt)}</td>
      <td><span class="badge status-${a.status}">${STATUS_LABELS[a.status]}</span></td><td></td></tr>`);
    if (a.status === 'scheduled') {
      const btn = el('<button class="btn btn-danger">Afzeggen</button>');
      btn.addEventListener('click', () => {
        const r = canTransition(a, 'cancelled', 'customer', nowStr(), bedrijf.cancelHours);
        if (!r.ok) { alert(r.reason); return; }
        store.appointments.update(a.id, { status: 'cancelled', cancelledAt: nowStr() });
        sendMail(store, bedrijf.email, 'Afspraak afgezegd',
          `${c.name} heeft de afspraak van ${fmtDT(a.startsAt)} (${cal.name}) afgezegd.`);
        renderAll();
      });
      tr.lastElementChild.appendChild(btn);
    }
    tbody.appendChild(tr);
  }
  box.appendChild(table);
}

// ---------- mijn facturen ----------
function renderMijnFacturen() {
  const box = document.getElementById('mijn-facturen');
  box.innerHTML = '';
  const c = currentCustomer();
  if (!c) { box.hidden = true; return; }
  box.hidden = false;
  box.appendChild(el('<h2>Mijn facturen</h2>'));
  const eigen = store.invoices.where(i =>
    i.recipientType === 'customer' && i.recipientId === c.id && i.status !== 'draft');
  if (!eigen.length) { box.appendChild(el('<p>Nog geen facturen.</p>')); return; }
  const table = el('<table><thead><tr><th>Nummer</th><th>Van</th><th>Bedrag</th><th>Status</th><th></th></tr></thead><tbody></tbody></table>');
  const tbody = table.querySelector('tbody');
  for (const inv of eigen) {
    const afzender = inv.issuerCompanyId ? store.companies.get(inv.issuerCompanyId) : { name: 'Platform', mollieLinked: true };
    const statusTekst = { sent: 'Openstaand', paid: 'Betaald', cancelled: 'Geannuleerd' }[inv.status] || inv.status;
    const tr = el(`<tr><td>${esc(inv.number)}</td><td>${esc(afzender.name)}</td>
      <td>${euro(inv.totals.inclCents)}</td><td>${esc(statusTekst)}</td><td></td></tr>`);
    const cell = tr.lastElementChild;
    if (inv.status === 'sent' && afzender.mollieLinked) {
      cell.appendChild(el(`<a class="btn" href="betaal.html?invoice=${inv.id}">Betalen</a>`));
    }
    const bekijk = el('<button class="btn btn-secondary">Bekijk</button>');
    bekijk.addEventListener('click', () => openInvoiceView(store, inv));
    cell.appendChild(bekijk);
    tbody.appendChild(tr);
  }
  box.appendChild(table);
}

// ---------- init ----------
function rebuildPicker() {
  const holder = document.getElementById('user-picker');
  holder.innerHTML = '';
  userPicker(holder, store.customers.all(), 'akp-klant', id => {
    currentCustomerId = id;
    renderAll();
  });
}

rebuildPicker();
