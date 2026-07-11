import { initStore, nowStr, todayStr, euro, fmtDT, el, esc, sendMail, renderMailbox, openInvoiceView } from './ui.js';
import { calcTotals, nextInvoiceNumber } from './logic/invoices.js';
import { STATUS_LABELS } from './logic/status.js';
import { appointmentsDueForReminder, invoicesDueForReminder, shiftDays } from './logic/reminders.js';
import { periodKey } from './logic/reports.js';
import { seedIfEmpty } from './seed.js';

const store = initStore();
let editor = null; // { companyId, lines: [] }
let rapPeriode = 'all';

function platformFacturen() { return store.invoices.where(i => i.issuerCompanyId === null); }
function refreshMailbox() { renderMailbox(store, document.getElementById('mailbox')); }

function renderAll() {
  renderKeuring();
  renderPlatformFacturen();
  renderRapportage();
  renderBeheer();
  refreshMailbox();
}

// ---------- keuringswachtrij ----------
function renderKeuring() {
  const box = document.getElementById('keuring');
  box.innerHTML = '';
  box.appendChild(el('<h2>Keuringswachtrij bedrijven</h2>'));
  const wachtrij = store.companies.where(c => !c.approvedAt && !c.rejectedReason);
  if (!wachtrij.length) { box.appendChild(el('<p>Geen bedrijven in de wachtrij.</p>')); return; }
  for (const b of wachtrij) {
    const kaart = el(`<div class="card">
      <h3>${esc(b.name)}</h3>
      ${b.logoDataUrl ? `<img class="logo" src="${b.logoDataUrl}" alt="logo">` : ''}
      <p>Adres: ${esc(b.street)} ${esc(b.houseNumber)}, ${esc(b.postalCode)} ${esc(b.city)}<br>
      KVK: <strong>${esc(b.kvk)}</strong> — Tel: ${esc(b.phone)} — E-mail: ${esc(b.email)}<br>
      E-mail geverifieerd: ${b.emailVerified ? '✔' : '✘'} — Telefoon geverifieerd: ${b.phoneVerified ? '✔' : '✘'}</p>
    </div>`);
    const goed = el('<button class="btn">Goedkeuren</button>');
    goed.addEventListener('click', () => {
      store.companies.update(b.id, { approvedAt: nowStr() });
      sendMail(store, b.email, 'Je bedrijf is goedgekeurd',
        `Beste ${b.name},\n\nJe registratie is goedgekeurd. Klanten kunnen nu bij je boeken.`);
      renderAll();
    });
    const af = el('<button class="btn btn-danger">Afkeuren</button>');
    af.addEventListener('click', () => {
      const reden = prompt('Reden van afkeuring:');
      if (!reden) return;
      store.companies.update(b.id, { rejectedReason: reden });
      sendMail(store, b.email, 'Registratie afgekeurd',
        `Beste ${b.name},\n\nJe registratie is afgekeurd. Reden: ${reden}`);
      renderAll();
    });
    kaart.append(goed, af);
    box.appendChild(kaart);
  }
}

// ---------- platformfacturen ----------
function renderPlatformFacturen() {
  const box = document.getElementById('platformfacturen');
  box.innerHTML = '';
  box.appendChild(el('<h2>Platformfacturen aan bedrijven</h2>'));

  if (!editor) editor = { companyId: null, lines: [{ description: '', qty: 1, unitPriceCents: 0, vatRate: 21 }] };
  const ed = el('<div class="card"><h3>Nieuwe factuur</h3></div>');
  const sel = el(`<select><option value="">— kies bedrijf —</option>
    ${store.companies.where(c => c.approvedAt).map(c =>
      `<option value="${c.id}" ${editor.companyId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
  </select>`);
  sel.addEventListener('change', () => { editor.companyId = Number(sel.value) || null; });
  ed.appendChild(el('<label>Bedrijf</label>'));
  ed.appendChild(sel);

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
    qty.addEventListener('input', e => { l.qty = Number(e.target.value) || 1; });
    prijs.addEventListener('input', e => { l.unitPriceCents = Math.round(Number(e.target.value) * 100) || 0; });
    btw.addEventListener('change', e => { l.vatRate = Number(e.target.value); });
    rij.querySelector('button').addEventListener('click', () => { editor.lines.splice(i, 1); renderPlatformFacturen(); });
    ed.appendChild(rij);
  });
  const plus = el('<button class="btn btn-secondary" type="button">+ Regel</button>');
  plus.addEventListener('click', () => { editor.lines.push({ description: '', qty: 1, unitPriceCents: 0, vatRate: 21 }); renderPlatformFacturen(); });
  ed.appendChild(plus);

  const stuur = el('<button class="btn" type="button">Versturen</button>');
  stuur.addEventListener('click', () => {
    if (!editor.companyId) { alert('Kies een bedrijf.'); return; }
    if (!editor.lines.length || editor.lines.some(l => !l.description)) { alert('Vul alle regelomschrijvingen in.'); return; }
    const nummer = nextInvoiceNumber(platformFacturen().map(i => i.number), Number(todayStr().slice(0, 4)));
    const totals = calcTotals(editor.lines);
    const inv = store.invoices.create({
      issuerCompanyId: null, recipientType: 'company', recipientId: editor.companyId,
      appointmentId: null, number: nummer, status: 'sent', issuedAt: nowStr(),
      dueAt: shiftDays(todayStr(), 14), paidAt: null, creditedInvoiceId: null,
      reminderCount: 0, lastReminderAt: null, lines: editor.lines, totals,
    });
    const b = store.companies.get(editor.companyId);
    sendMail(store, b.email, `Factuur ${nummer} van het platform`,
      `Beste ${b.name},\n\nHierbij factuur ${nummer}: ${euro(totals.inclCents)}.\n\nBetaal online: betaal.html?invoice=${inv.id}`);
    editor = null;
    renderAll();
  });
  ed.appendChild(stuur);
  box.appendChild(ed);

  const lijst = platformFacturen().sort((a, z) => z.id - a.id);
  if (!lijst.length) { box.appendChild(el('<p>Nog geen platformfacturen.</p>')); return; }
  const statusTekst = { sent: 'Onbetaald', paid: 'Betaald', cancelled: 'Geannuleerd' };
  const t = el('<table><thead><tr><th>Nummer</th><th>Bedrijf</th><th>Bedrag</th><th>Status</th><th></th></tr></thead><tbody></tbody></table>');
  for (const inv of lijst) {
    const b = store.companies.get(inv.recipientId);
    const tr = el(`<tr><td>${esc(inv.number)}</td><td>${esc(b.name)}</td>
      <td>${euro(inv.totals.inclCents)}</td><td>${statusTekst[inv.status] || inv.status}</td><td></td></tr>`);
    const cell = tr.lastElementChild;
    if (inv.status === 'sent') {
      const betaald = el('<button class="btn">Markeer betaald</button>');
      betaald.addEventListener('click', () => { store.invoices.update(inv.id, { status: 'paid', paidAt: nowStr() }); renderAll(); });
      cell.appendChild(betaald);
    }
    const bekijk = el('<button class="btn btn-secondary">Bekijk</button>');
    bekijk.addEventListener('click', () => openInvoiceView(store, inv));
    cell.appendChild(bekijk);
    t.querySelector('tbody').appendChild(tr);
  }
  box.appendChild(t);
}

// ---------- rapportage per bedrijf ----------
function inPeriode(dt) {
  if (!dt) return false;
  if (rapPeriode === 'all') return true;
  const key = { month: 'month', quarter: 'quarter', year: 'year' }[rapPeriode];
  return periodKey(dt, key) === periodKey(todayStr(), key);
}

function renderRapportage() {
  const box = document.getElementById('rapportage');
  box.innerHTML = '';
  box.appendChild(el('<h2>Afspraken en omzet per bedrijf</h2>'));
  const sel = el(`<select>
    <option value="month" ${rapPeriode === 'month' ? 'selected' : ''}>Deze maand</option>
    <option value="quarter" ${rapPeriode === 'quarter' ? 'selected' : ''}>Dit kwartaal</option>
    <option value="year" ${rapPeriode === 'year' ? 'selected' : ''}>Dit jaar</option>
    <option value="all" ${rapPeriode === 'all' ? 'selected' : ''}>Alles</option>
  </select>`);
  sel.addEventListener('change', () => { rapPeriode = sel.value; renderRapportage(); });
  box.appendChild(sel);

  const t = el(`<table><thead><tr><th>Bedrijf</th><th>Afspraken</th>
    <th>${Object.values(STATUS_LABELS).join(' / ')}</th><th>Omzet (betaald)</th></tr></thead><tbody></tbody></table>`);
  for (const b of store.companies.where(c => c.approvedAt)) {
    const calIds = new Set(store.calendars.where(c => c.companyId === b.id).map(c => c.id));
    const appts = store.appointments.where(a => calIds.has(a.calendarId) && inPeriode(a.startsAt));
    const per = s => appts.filter(a => a.status === s).length;
    const omzet = store.invoices
      .where(i => i.issuerCompanyId === b.id && i.status === 'paid' && inPeriode(i.paidAt))
      .reduce((sum, i) => sum + i.totals.inclCents, 0);
    t.querySelector('tbody').appendChild(el(`<tr><td>${esc(b.name)}</td><td>${appts.length}</td>
      <td>${per('scheduled')} / ${per('cancelled')} / ${per('completed')} / ${per('no_show')}</td>
      <td>${euro(omzet)}</td></tr>`));
  }
  box.appendChild(t);
}

// ---------- beheer ----------
function renderBeheer() {
  const box = document.getElementById('beheer');
  box.innerHTML = '';
  box.appendChild(el('<h2>Beheer</h2>'));

  const taken = el('<button class="btn">▶ Simuleer dagelijkse taken</button>');
  taken.addEventListener('click', () => {
    let nAppt = 0, nInv = 0;
    for (const a of appointmentsDueForReminder(store.appointments.all(), nowStr())) {
      const klant = store.customers.get(a.customerId);
      const cal = store.calendars.get(a.calendarId);
      const b = store.companies.get(cal.companyId);
      sendMail(store, klant.email, 'Herinnering: je afspraak morgen',
        `Beste ${klant.name},\n\nHerinnering: je afspraak bij ${b.name} (${cal.name}) op ${fmtDT(a.startsAt)}.`);
      store.appointments.update(a.id, { reminderSentAt: nowStr() });
      nAppt++;
    }
    for (const inv of invoicesDueForReminder(store.invoices.all(), todayStr())) {
      const ontvanger = inv.recipientType === 'customer'
        ? store.customers.get(inv.recipientId) : store.companies.get(inv.recipientId);
      sendMail(store, ontvanger.email, `Betalingsherinnering factuur ${inv.number}`,
        `Beste ${ontvanger.name},\n\nFactuur ${inv.number} staat nog open (vervallen op ${inv.dueAt}).\nBetaal online: betaal.html?invoice=${inv.id}`);
      store.invoices.update(inv.id, { reminderCount: inv.reminderCount + 1, lastReminderAt: nowStr() });
      nInv++;
    }
    box.querySelector('#taken-uitslag').textContent =
      `${nAppt} afspraakherinneringen, ${nInv} betalingsherinneringen verstuurd.`;
    refreshMailbox();
    renderRapportage();
  });
  box.appendChild(taken);
  box.appendChild(el('<p id="taken-uitslag"></p>'));

  const reset = el('<button class="btn btn-danger">↺ Reset demo-data</button>');
  reset.addEventListener('click', () => {
    if (!confirm('Alle demo-data terugzetten naar de beginstand?')) return;
    store.reset();
    seedIfEmpty(store, todayStr());
    location.reload();
  });
  box.appendChild(reset);
}

renderAll();
