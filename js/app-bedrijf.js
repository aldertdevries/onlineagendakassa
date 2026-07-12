import { initStore, nowStr, todayStr, euro, fmtDT, el, esc, sendMail, renderMailbox, userPicker, openInvoiceView } from './ui.js';
import { calcTotals, nextInvoiceNumber, creditLines } from './logic/invoices.js';
import { canTransition, STATUS_LABELS } from './logic/status.js';
import { shiftDays } from './logic/reminders.js';
import { paymentStatusOfAppointment, revenueByPeriod, inactiveCustomers } from './logic/reports.js';

const store = initStore();
let currentCompanyId = null;
let editor = null; // { draftId, customerId, appointmentId, lines: [] }
let afsprakenFilter = { status: '', dag: '' };
let factuurFilter = '';
let omzetPeriode = 'month';
let inactiefMin = 30, inactiefMax = 90;

const WEEKDAGEN = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

function bedrijf() { return currentCompanyId ? store.companies.get(currentCompanyId) : null; }
function eigenAgendas() { return store.calendars.where(c => c.companyId === currentCompanyId); }
function eigenAfspraken() {
  const ids = new Set(eigenAgendas().map(c => c.id));
  return store.appointments.where(a => ids.has(a.calendarId));
}
function eigenFacturen() { return store.invoices.where(i => i.issuerCompanyId === currentCompanyId); }

function refreshMailbox() { renderMailbox(store, document.getElementById('mailbox')); }

function renderAll() {
  renderRegistratie();
  const b = bedrijf();
  const toegang = b && b.emailVerified && b.phoneVerified && b.approvedAt;
  for (const id of ['agendas', 'afspraken', 'facturen', 'rapportages'])
    document.getElementById(id).hidden = !toegang;
  if (toegang) {
    renderAgendas();
    renderAfspraken();
    renderFacturen();
    renderRapportages();
  }
  refreshMailbox();
}

// ---------- registratie / status ----------
function renderRegistratie() {
  const box = document.getElementById('registratie');
  box.innerHTML = '';
  const b = bedrijf();

  if (!b) {
    box.appendChild(el('<h2>Nieuw bedrijf? Registreer je</h2>'));
    const form = el(`<form>
      <label>Bedrijfsnaam</label><input name="name" required>
      <label>Straat</label><input name="street" required>
      <label>Huisnummer</label><input name="houseNumber" required>
      <label>Postcode</label><input name="postalCode" required>
      <label>Plaats</label><input name="city" required>
      <label>WhatsApp-telefoonnummer</label><input name="phone" placeholder="+316..." required>
      <label>E-mail</label><input name="email" type="email" required>
      <label>KVK-nummer</label><input name="kvk" required>
      <label>Logo (wordt 300×300 getoond)</label><input name="logo" type="file" accept="image/*">
      <button class="btn" type="submit">Registreren</button>
    </form>`);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(form);
      const smsCode = String(Math.floor(Math.random() * 900000 + 100000));
      const maak = logoDataUrl => {
        const rec = store.companies.create({
          name: f.get('name'), street: f.get('street'), houseNumber: f.get('houseNumber'),
          postalCode: f.get('postalCode'), city: f.get('city'), phone: f.get('phone'),
          email: f.get('email'), kvk: f.get('kvk'), logoDataUrl,
          emailVerified: false, phoneVerified: false, approvedAt: null,
          rejectedReason: null, mollieLinked: false, cancelHours: 24, smsCode,
        });
        sendMail(store, rec.email, 'Bevestig je e-mailadres',
          `Beste ${rec.name},\n\nKlik op de link om je e-mailadres te bevestigen.\n(Simulatie: gebruik de knop in het bedrijfsportaal.)`);
        window.localStorage.setItem('akp-bedrijf', String(rec.id));
        currentCompanyId = rec.id;
        rebuildPicker();
        renderAll();
      };
      const file = form.querySelector('[name=logo]').files[0];
      if (file) {
        const r = new FileReader();
        r.onload = () => maak(r.result);
        r.readAsDataURL(file);
      } else {
        maak(null);
      }
    });
    box.appendChild(form);
    return;
  }

  box.appendChild(el(`<h2>${esc(b.name)}</h2>`));
  if (b.logoDataUrl) box.appendChild(el(`<img class="logo" src="${b.logoDataUrl}" alt="logo">`));

  if (!b.emailVerified) {
    const btn = el('<button class="btn">✔ Simuleer de e-mailverificatielink</button>');
    btn.addEventListener('click', () => { store.companies.update(b.id, { emailVerified: true }); renderAll(); });
    box.appendChild(el('<p>1. E-mail: verificatiemail "verstuurd" (zie postvak).</p>'));
    box.appendChild(btn);
  } else box.appendChild(el('<p>1. E-mail geverifieerd ✔</p>'));

  if (!b.phoneVerified) {
    if (!b.smsCode)
      store.companies.update(b.id, { smsCode: String(Math.floor(Math.random() * 900000 + 100000)) });
    const code = store.companies.get(b.id).smsCode;
    box.appendChild(el(`<p>2. SMS-code (simulatie): <strong>${esc(code)}</strong></p>`));
    const form = el(`<form class="regel-rij"><input name="code" placeholder="Voer de code in">
      <button class="btn" type="submit">Verifieer telefoon</button></form>`);
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (new FormData(form).get('code') === store.companies.get(b.id).smsCode) {
        store.companies.update(b.id, { phoneVerified: true });
        renderAll();
      } else alert('Onjuiste code.');
    });
    box.appendChild(form);
  } else box.appendChild(el('<p>2. Telefoon geverifieerd ✔</p>'));

  if (b.rejectedReason) {
    box.appendChild(el(`<div class="banner banner-error">Registratie afgekeurd: ${esc(b.rejectedReason)}</div>`));
  } else if (!b.approvedAt && b.emailVerified && b.phoneVerified) {
    box.appendChild(el('<div class="banner banner-warn">3. Wacht op goedkeuring door de beheerder (adminportaal).</div>'));
  } else if (b.approvedAt) {
    box.appendChild(el('<p>3. Goedgekeurd door de beheerder ✔</p>'));
  }
}

// ---------- agenda's ----------
function renderAgendas() {
  const box = document.getElementById('agendas');
  const b = bedrijf();
  box.innerHTML = '';
  box.appendChild(el("<h2>Agenda's en instellingen</h2>"));

  // instellingen
  const inst = el(`<div class="regel-rij">
    <label>Afzegtermijn (uren) <input id="cancel-uren" type="number" min="0" value="${b.cancelHours}" style="max-width:6rem"></label>
    <label><input id="mollie" type="checkbox" ${b.mollieLinked ? 'checked' : ''}> Mollie gekoppeld (simulatie API-sleutel)</label>
  </div>`);
  inst.querySelector('#cancel-uren').addEventListener('change', e =>
    store.companies.update(b.id, { cancelHours: Number(e.target.value) || 0 }));
  inst.querySelector('#mollie').addEventListener('change', e =>
    store.companies.update(b.id, { mollieLinked: e.target.checked }));
  box.appendChild(inst);

  for (const cal of eigenAgendas()) {
    const kaart = el(`<div class="card"><h3>${esc(cal.name)} — ${cal.slotMinutes} min
      <label style="font-weight:normal"><input type="checkbox" class="actief" ${cal.active ? 'checked' : ''}> actief</label></h3>
      <h4>Openingstijden</h4><div class="uren"></div>
      <h4>Blokkades</h4><div class="blokkades"></div>
    </div>`);
    kaart.querySelector('.actief').addEventListener('change', e =>
      store.calendars.update(cal.id, { active: e.target.checked }));

    const urenBox = kaart.querySelector('.uren');
    for (const oh of store.openingHours.where(h => h.calendarId === cal.id)
      .sort((a, z) => a.weekday - z.weekday || (a.start < z.start ? -1 : 1))) {
      const rij = el(`<div class="regel-rij"><span style="width:6.5rem;display:inline-block">${WEEKDAGEN[oh.weekday]}</span>
        <span>${esc(oh.start)}–${esc(oh.end)}</span><button class="btn btn-danger">×</button></div>`);
      rij.querySelector('button').addEventListener('click', () => { store.openingHours.remove(oh.id); renderAgendas(); });
      urenBox.appendChild(rij);
    }
    const urenForm = el(`<form class="regel-rij">
      <select name="weekday">${WEEKDAGEN.map((d, i) => `<option value="${i}" ${i === 1 ? 'selected' : ''}>${d}</option>`).join('')}</select>
      <input name="start" type="time" value="09:00" required>
      <input name="end" type="time" value="17:00" required>
      <button class="btn" type="submit">+ Tijdvak</button></form>`);
    urenForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(urenForm);
      if (f.get('end') <= f.get('start')) { alert('Eindtijd moet na begintijd liggen.'); return; }
      store.openingHours.create({ calendarId: cal.id, weekday: Number(f.get('weekday')), start: f.get('start'), end: f.get('end') });
      renderAgendas();
    });
    urenBox.appendChild(urenForm);

    const blokBox = kaart.querySelector('.blokkades');
    for (const bl of store.blocks.where(x => x.calendarId === cal.id)) {
      const rij = el(`<div class="regel-rij"><span>${fmtDT(bl.from)} t/m ${fmtDT(bl.to)} — ${esc(bl.reason)}</span>
        <button class="btn btn-danger">×</button></div>`);
      rij.querySelector('button').addEventListener('click', () => { store.blocks.remove(bl.id); renderAll(); });
      blokBox.appendChild(rij);
      const getroffen = store.appointments.where(a =>
        a.calendarId === cal.id && a.status === 'scheduled' && a.startsAt < bl.to && a.endsAt > bl.from);
      for (const a of getroffen) {
        const klant = store.customers.get(a.customerId);
        const arij = el(`<div class="regel-rij banner-warn banner">⚠ ${esc(klant.name)} — ${fmtDT(a.startsAt)}
          <button class="btn btn-danger">Afzeggen</button></div>`);
        arij.querySelector('button').addEventListener('click', () => zetStatus(a, 'cancelled'));
        blokBox.appendChild(arij);
      }
    }
    const blokForm = el(`<form class="regel-rij">
      <input name="from" type="datetime-local" required>
      <input name="to" type="datetime-local" required>
      <input name="reason" placeholder="Reden (vakantie...)" required>
      <button class="btn" type="submit">+ Blokkade</button></form>`);
    blokForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(blokForm);
      if (f.get('to') <= f.get('from')) { alert('Einde moet na begin liggen.'); return; }
      store.blocks.create({ calendarId: cal.id, from: f.get('from'), to: f.get('to'), reason: f.get('reason') });
      renderAgendas();
    });
    blokBox.appendChild(blokForm);
    box.appendChild(kaart);
  }

  const max = eigenAgendas().length >= 4;
  const nieuwForm = el(`<form class="regel-rij">
    <input name="name" placeholder="Naam nieuwe agenda" required ${max ? 'disabled' : ''}>
    <select name="slot" ${max ? 'disabled' : ''}>
      <option value="15">15 min</option><option value="30" selected>30 min</option><option value="60">60 min</option>
    </select>
    <button class="btn" type="submit" ${max ? 'disabled' : ''}>${max ? 'Maximaal 4 agenda’s' : '+ Nieuwe agenda'}</button>
  </form>`);
  nieuwForm.addEventListener('submit', e => {
    e.preventDefault();
    if (eigenAgendas().length >= 4) return;
    const f = new FormData(nieuwForm);
    store.calendars.create({ companyId: b.id, name: f.get('name'), slotMinutes: Number(f.get('slot')), active: true });
    renderAgendas();
  });
  box.appendChild(nieuwForm);
}

// ---------- afspraken ----------
function zetStatus(appt, to) {
  const r = canTransition(appt, to, 'company', nowStr(), bedrijf().cancelHours);
  if (!r.ok) { alert(r.reason); return; }
  const stempel = { cancelled: 'cancelledAt', completed: 'completedAt', no_show: 'noShowAt' }[to];
  store.appointments.update(appt.id, { status: to, [stempel]: nowStr() });
  const klant = store.customers.get(appt.customerId);
  const cal = store.calendars.get(appt.calendarId);
  sendMail(store, klant.email, `Afspraak ${STATUS_LABELS[to].toLowerCase()}`,
    `Beste ${klant.name},\n\nJe afspraak bij ${bedrijf().name} (${cal.name}) van ${fmtDT(appt.startsAt)} heeft nu de status: ${STATUS_LABELS[to]}.`);
  renderAll();
}

function renderAfspraken() {
  const box = document.getElementById('afspraken');
  box.innerHTML = '';
  box.appendChild(el('<h2>Afspraken</h2>'));

  const filter = el(`<div class="regel-rij">
    <select id="f-status"><option value="">Alle statussen</option>
      ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${afsprakenFilter.status === k ? 'selected' : ''}>${v}</option>`).join('')}
    </select>
    <input id="f-dag" type="date" value="${afsprakenFilter.dag}">
    <button class="btn btn-secondary" id="f-reset">Wis filters</button>
  </div>`);
  filter.querySelector('#f-status').addEventListener('change', e => { afsprakenFilter.status = e.target.value; renderAfspraken(); });
  filter.querySelector('#f-dag').addEventListener('change', e => { afsprakenFilter.dag = e.target.value; renderAfspraken(); });
  filter.querySelector('#f-reset').addEventListener('click', () => { afsprakenFilter = { status: '', dag: '' }; renderAfspraken(); });
  box.appendChild(filter);

  let lijst = eigenAfspraken().sort((a, z) => (a.startsAt < z.startsAt ? 1 : -1));
  if (afsprakenFilter.status) lijst = lijst.filter(a => a.status === afsprakenFilter.status);
  if (afsprakenFilter.dag) lijst = lijst.filter(a => a.startsAt.startsWith(afsprakenFilter.dag));
  if (!lijst.length) { box.appendChild(el('<p>Geen afspraken.</p>')); return; }

  const table = el('<table><thead><tr><th>Klant</th><th>Agenda</th><th>Wanneer</th><th>Status</th><th></th></tr></thead><tbody></tbody></table>');
  const tbody = table.querySelector('tbody');
  for (const a of lijst) {
    const klant = store.customers.get(a.customerId);
    const cal = store.calendars.get(a.calendarId);
    const tr = el(`<tr><td>${esc(klant.name)}</td><td>${esc(cal.name)}</td><td>${fmtDT(a.startsAt)}</td>
      <td><span class="badge status-${a.status}">${STATUS_LABELS[a.status]}</span></td><td></td></tr>`);
    const cell = tr.lastElementChild;
    if (a.status === 'scheduled') {
      for (const [to, label] of [['completed', 'Voltooid'], ['cancelled', 'Afgezegd'], ['no_show', 'No-show']]) {
        const btn = el(`<button class="btn ${to === 'completed' ? '' : 'btn-secondary'}">${label}</button>`);
        btn.addEventListener('click', () => zetStatus(a, to));
        cell.appendChild(btn);
      }
    }
    if (a.status === 'completed' && paymentStatusOfAppointment(a, store.invoices.all()) === 'geen_factuur') {
      const btn = el('<button class="btn">→ Factuur maken</button>');
      btn.addEventListener('click', () => {
        editor = { draftId: null, customerId: a.customerId, appointmentId: a.id,
          lines: [{ description: '', qty: 1, unitPriceCents: 0, vatRate: 21 }] };
        renderFacturen();
        document.getElementById('facturen').scrollIntoView({ behavior: 'smooth' });
      });
      cell.appendChild(btn);
    }
    tbody.appendChild(tr);
  }
  box.appendChild(table);
}

// ---------- facturen ----------
function verstuurFactuur(inv) {
  const b = bedrijf();
  const nummer = nextInvoiceNumber(eigenFacturen().map(i => i.number), Number(todayStr().slice(0, 4)));
  const totals = calcTotals(inv.lines);
  store.invoices.update(inv.id, {
    number: nummer, status: 'sent', issuedAt: nowStr(),
    dueAt: shiftDays(todayStr(), 14), totals,
  });
  const bij = store.invoices.get(inv.id);
  const ontvanger = store.customers.get(inv.recipientId);
  const regels = inv.lines.map(l => `- ${l.description}: ${l.qty} × ${euro(l.unitPriceCents)} (${l.vatRate}% BTW)`).join('\n');
  let body = `Beste ${ontvanger.name},\n\nHierbij factuur ${nummer} van ${b.name}:\n${regels}\nTotaal: ${euro(totals.inclCents)}\n\n(Simulatie: de PDF is de printbare weergave in de app.)`;
  if (b.mollieLinked) body += `\n\nBetaal online: betaal.html?invoice=${inv.id}`;
  else body += `\n\nMaak het bedrag over o.v.v. het factuurnummer.`;
  sendMail(store, ontvanger.email, `Factuur ${nummer} van ${b.name}`, body);
  return bij;
}

function renderFacturen() {
  const box = document.getElementById('facturen');
  box.innerHTML = '';
  box.appendChild(el('<h2>Facturen</h2>'));

  // --- editor ---
  const ed = el('<div class="card"><h3>' + (editor && editor.draftId ? 'Concept bewerken' : 'Nieuwe factuur') + '</h3></div>');
  if (!editor) editor = { draftId: null, customerId: null, appointmentId: null,
    lines: [{ description: '', qty: 1, unitPriceCents: 0, vatRate: 21 }] };

  const klantSel = el(`<select><option value="">— kies klant —</option>
    ${store.customers.all().map(c => `<option value="${c.id}" ${editor.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
  </select>`);
  klantSel.addEventListener('change', () => { editor.customerId = Number(klantSel.value) || null; });
  ed.appendChild(el('<label>Klant</label>'));
  ed.appendChild(klantSel);
  if (editor.appointmentId) ed.appendChild(el(`<p><em>Gekoppeld aan afspraak #${editor.appointmentId}</em></p>`));

  const regelsBox = el('<div></div>');
  editor.lines.forEach((l, i) => {
    const rij = el(`<div class="regel-rij">
      <input class="omschrijving" placeholder="Omschrijving" value="${esc(l.description)}">
      <input type="number" min="1" value="${l.qty}" title="Aantal">
      <input type="number" step="0.01" min="0" value="${(l.unitPriceCents / 100).toFixed(2)}" title="Stukprijs €">
      <select><option value="21" ${l.vatRate === 21 ? 'selected' : ''}>21%</option>
        <option value="9" ${l.vatRate === 9 ? 'selected' : ''}>9%</option>
        <option value="0" ${l.vatRate === 0 ? 'selected' : ''}>0%</option></select>
      <button class="btn btn-danger" type="button">×</button>
    </div>`);
    const [oms, qty, prijs, btw] = rij.querySelectorAll('input, select');
    oms.addEventListener('input', e => { l.description = e.target.value; });
    qty.addEventListener('input', e => { l.qty = Number(e.target.value) || 1; toonTotalen(); });
    prijs.addEventListener('input', e => { l.unitPriceCents = Math.round(Number(e.target.value) * 100) || 0; toonTotalen(); });
    btw.addEventListener('change', e => { l.vatRate = Number(e.target.value); toonTotalen(); });
    rij.querySelector('button').addEventListener('click', () => { editor.lines.splice(i, 1); renderFacturen(); });
    regelsBox.appendChild(rij);
  });
  ed.appendChild(regelsBox);

  const totalenEl = el('<p id="ed-totalen"></p>');
  function toonTotalen() {
    const t = calcTotals(editor.lines);
    totalenEl.textContent = `Excl. ${euro(t.exclCents)} — BTW ${euro(t.vatCents)} — Incl. ${euro(t.inclCents)}`;
  }
  toonTotalen();

  const plusRegel = el('<button class="btn btn-secondary" type="button">+ Regel</button>');
  plusRegel.addEventListener('click', () => {
    editor.lines.push({ description: '', qty: 1, unitPriceCents: 0, vatRate: 21 });
    renderFacturen();
  });
  ed.appendChild(plusRegel);
  ed.appendChild(totalenEl);

  function valideer() {
    if (!editor.customerId) { alert('Kies een klant.'); return false; }
    if (!editor.lines.length || editor.lines.some(l => !l.description)) { alert('Vul alle regelomschrijvingen in.'); return false; }
    return true;
  }
  function bewaarConcept() {
    const data = {
      issuerCompanyId: currentCompanyId, recipientType: 'customer', recipientId: editor.customerId,
      appointmentId: editor.appointmentId, number: null, status: 'draft',
      issuedAt: null, dueAt: null, paidAt: null, creditedInvoiceId: null,
      reminderCount: 0, lastReminderAt: null, lines: editor.lines, totals: null,
    };
    const rec = editor.draftId ? store.invoices.update(editor.draftId, data) : store.invoices.create(data);
    return rec;
  }
  const conceptBtn = el('<button class="btn btn-secondary" type="button">Opslaan als concept</button>');
  conceptBtn.addEventListener('click', () => {
    if (!valideer()) return;
    bewaarConcept();
    editor = null;
    renderAll();
  });
  const verstuurBtn = el('<button class="btn" type="button">Versturen</button>');
  verstuurBtn.addEventListener('click', () => {
    if (!valideer()) return;
    verstuurFactuur(bewaarConcept());
    editor = null;
    renderAll();
  });
  ed.appendChild(conceptBtn);
  ed.appendChild(verstuurBtn);
  box.appendChild(ed);

  // --- lijst ---
  const filter = el(`<div class="regel-rij"><select id="fac-filter">
    <option value="">Alle</option>
    <option value="draft" ${factuurFilter === 'draft' ? 'selected' : ''}>Concepten</option>
    <option value="sent" ${factuurFilter === 'sent' ? 'selected' : ''}>Onbetaald</option>
    <option value="paid" ${factuurFilter === 'paid' ? 'selected' : ''}>Betaald</option>
    <option value="cancelled" ${factuurFilter === 'cancelled' ? 'selected' : ''}>Geannuleerd</option>
  </select></div>`);
  filter.querySelector('select').addEventListener('change', e => { factuurFilter = e.target.value; renderFacturen(); });
  box.appendChild(filter);

  let lijst = eigenFacturen().sort((a, z) => z.id - a.id);
  if (factuurFilter) lijst = lijst.filter(i => i.status === factuurFilter);
  if (!lijst.length) { box.appendChild(el('<p>Geen facturen.</p>')); return; }

  const statusTekst = { draft: 'Concept', sent: 'Onbetaald', paid: 'Betaald', cancelled: 'Geannuleerd' };
  const table = el('<table><thead><tr><th>Nummer</th><th>Klant</th><th>Bedrag</th><th>Status</th><th></th></tr></thead><tbody></tbody></table>');
  const tbody = table.querySelector('tbody');
  for (const inv of lijst) {
    const klant = store.customers.get(inv.recipientId);
    const bedrag = inv.totals ? euro(inv.totals.inclCents) : euro(calcTotals(inv.lines).inclCents) + ' (concept)';
    const credit = inv.creditedInvoiceId ? ' (creditnota)' : '';
    const tr = el(`<tr><td>${esc(inv.number || '—')}${credit}</td><td>${esc(klant ? klant.name : '?')}</td>
      <td>${bedrag}</td><td>${statusTekst[inv.status]}</td><td></td></tr>`);
    const cell = tr.lastElementChild;

    if (inv.status === 'draft') {
      const bewerk = el('<button class="btn btn-secondary">Bewerken</button>');
      bewerk.addEventListener('click', () => {
        editor = { draftId: inv.id, customerId: inv.recipientId, appointmentId: inv.appointmentId,
          lines: inv.lines.map(l => ({ ...l })) };
        renderFacturen();
      });
      const weg = el('<button class="btn btn-danger">Verwijderen</button>');
      weg.addEventListener('click', () => { if (confirm('Concept verwijderen?')) { store.invoices.remove(inv.id); renderFacturen(); } });
      const stuur = el('<button class="btn">Versturen</button>');
      stuur.addEventListener('click', () => { verstuurFactuur(inv); renderAll(); });
      cell.append(bewerk, stuur, weg);
    }
    if (inv.status === 'sent') {
      const betaald = el('<button class="btn">Markeer betaald</button>');
      betaald.addEventListener('click', () => {
        store.invoices.update(inv.id, { status: 'paid', paidAt: nowStr() });
        renderAll();
      });
      const annuleer = el('<button class="btn btn-danger">Annuleren</button>');
      annuleer.addEventListener('click', () => {
        if (confirm(`Factuur ${inv.number} annuleren?`)) {
          store.invoices.update(inv.id, { status: 'cancelled' });
          renderAll();
        }
      });
      cell.append(betaald, annuleer);
    }
    if (inv.status === 'sent' || inv.status === 'paid') {
      const credit = el('<button class="btn btn-secondary">Creditnota</button>');
      credit.addEventListener('click', () => {
        if (!confirm(`Creditnota maken voor ${inv.number}?`)) return;
        const nummer = nextInvoiceNumber(eigenFacturen().map(i => i.number), Number(todayStr().slice(0, 4)));
        const lines = creditLines(inv.lines);
        const nota = store.invoices.create({
          issuerCompanyId: currentCompanyId, recipientType: 'customer', recipientId: inv.recipientId,
          appointmentId: null, number: nummer, status: 'sent', issuedAt: nowStr(),
          dueAt: shiftDays(todayStr(), 14), paidAt: null, creditedInvoiceId: inv.id,
          reminderCount: 0, lastReminderAt: null, lines, totals: calcTotals(lines),
        });
        const ontvanger = store.customers.get(inv.recipientId);
        sendMail(store, ontvanger.email, `Creditnota ${nummer} (bij factuur ${inv.number})`,
          `Beste ${ontvanger.name},\n\nHierbij creditnota ${nummer} van ${bedrijf().name} voor factuur ${inv.number}: ${euro(nota.totals.inclCents)}.`);
        renderAll();
      });
      cell.appendChild(credit);
    }
    if (inv.totals) {
      const bekijk = el('<button class="btn btn-secondary">Bekijk</button>');
      bekijk.addEventListener('click', () => openInvoiceView(store, inv));
      cell.appendChild(bekijk);
    }
    tbody.appendChild(tr);
  }
  box.appendChild(table);
}

// ---------- rapportages ----------
function renderRapportages() {
  const box = document.getElementById('rapportages');
  box.innerHTML = '';
  box.appendChild(el('<h2>Rapportages</h2>'));

  // 1. voltooide afspraken met betaalstatus
  box.appendChild(el('<h3>Voltooide afspraken en betaalstatus</h3>'));
  const voltooid = eigenAfspraken().filter(a => a.status === 'completed');
  if (!voltooid.length) box.appendChild(el('<p>Geen voltooide afspraken.</p>'));
  else {
    const t = el('<table><thead><tr><th>Klant</th><th>Wanneer</th><th>Betaalstatus</th></tr></thead><tbody></tbody></table>');
    const labels = { betaald: 'Betaald', openstaand: 'Factuur openstaand', geen_factuur: 'Nog geen factuur' };
    for (const a of voltooid) {
      const st = paymentStatusOfAppointment(a, store.invoices.all());
      t.querySelector('tbody').appendChild(el(`<tr><td>${esc(store.customers.get(a.customerId).name)}</td>
        <td>${fmtDT(a.startsAt)}</td><td><span class="badge pay-${st}">${labels[st]}</span></td></tr>`));
    }
    box.appendChild(t);
  }

  // 2. omzet per periode
  box.appendChild(el('<h3>Omzet (betaalde facturen)</h3>'));
  const perSel = el(`<select>
    <option value="day" ${omzetPeriode === 'day' ? 'selected' : ''}>Per dag</option>
    <option value="week" ${omzetPeriode === 'week' ? 'selected' : ''}>Per week</option>
    <option value="month" ${omzetPeriode === 'month' ? 'selected' : ''}>Per maand</option>
    <option value="quarter" ${omzetPeriode === 'quarter' ? 'selected' : ''}>Per kwartaal</option>
    <option value="year" ${omzetPeriode === 'year' ? 'selected' : ''}>Per jaar</option>
  </select>`);
  perSel.addEventListener('change', () => { omzetPeriode = perSel.value; renderRapportages(); });
  box.appendChild(perSel);
  const omzet = revenueByPeriod(eigenFacturen(), omzetPeriode);
  const keys = Object.keys(omzet).sort().reverse();
  if (!keys.length) box.appendChild(el('<p>Nog geen omzet.</p>'));
  else {
    const t = el('<table><thead><tr><th>Periode</th><th>Omzet</th></tr></thead><tbody></tbody></table>');
    for (const k of keys)
      t.querySelector('tbody').appendChild(el(`<tr><td>${esc(k)}</td><td>${euro(omzet[k])}</td></tr>`));
    box.appendChild(t);
  }

  // 3. inactieve klanten
  box.appendChild(el('<h3>Inactieve klanten</h3>'));
  const vorm = el(`<div class="regel-rij">
    Laatste afspraak tussen <input id="in-min" type="number" min="0" value="${inactiefMin}" style="max-width:5rem">
    en <input id="in-max" type="number" min="0" value="${inactiefMax}" style="max-width:5rem"> dagen geleden
    <button class="btn btn-secondary" id="in-zoek">Zoek</button></div>`);
  vorm.querySelector('#in-zoek').addEventListener('click', () => {
    inactiefMin = Number(vorm.querySelector('#in-min').value) || 0;
    inactiefMax = Number(vorm.querySelector('#in-max').value) || 0;
    renderRapportages();
  });
  box.appendChild(vorm);
  const klantIds = new Set(eigenAfspraken().map(a => a.customerId));
  const eigenKlanten = store.customers.where(c => klantIds.has(c.id));
  const inactief = inactiveCustomers(eigenAfspraken(), eigenKlanten, inactiefMin, inactiefMax, todayStr());
  if (!inactief.length) box.appendChild(el('<p>Geen klanten in dit venster.</p>'));
  else {
    const t = el('<table><thead><tr><th>Klant</th><th>Laatste afspraak</th></tr></thead><tbody></tbody></table>');
    for (const r of inactief)
      t.querySelector('tbody').appendChild(el(`<tr><td>${esc(r.customer.name)}</td><td>${fmtDT(r.lastAppointmentAt)}</td></tr>`));
    box.appendChild(t);
  }
}

// ---------- init ----------
function rebuildPicker() {
  const holder = document.getElementById('user-picker');
  holder.innerHTML = '';
  userPicker(holder, store.companies.all(), 'akp-bedrijf', id => {
    currentCompanyId = id;
    editor = null;
    renderAll();
  });
}

rebuildPicker();
