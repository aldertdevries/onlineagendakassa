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

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function sendMail(store, to, subject, body, meta = {}) {
  return store.mails.create({ to, subject, body, sentAt: nowStr(), ...meta });
}

export function renderMailbox(store, containerEl) {
  const mails = store.mails.all().sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  containerEl.innerHTML = '';
  containerEl.appendChild(el(`<h2>📧 Postvak (simulatie) — ${mails.length}</h2>`));
  for (const m of mails) {
    containerEl.appendChild(el(`<details class="mail">
      <summary>${esc(m.sentAt.replace('T', ' '))} — aan ${esc(m.to)}: <strong>${esc(m.subject)}</strong></summary>
      <pre>${esc(m.body)}</pre>
    </details>`));
  }
}

export function userPicker(containerEl, items, storageKey, onChange) {
  const saved = Number(window.localStorage.getItem(storageKey));
  const sel = el(`<select></select>`);
  sel.appendChild(el(`<option value="">— kies —</option>`));
  for (const it of items) {
    const o = el(`<option value="${it.id}">${esc(it.name)}</option>`);
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

// Printbare factuurweergave in een nieuw venster.
export function openInvoiceView(store, invoice) {
  const afzender = invoice.issuerCompanyId
    ? store.companies.get(invoice.issuerCompanyId)
    : { name: 'Afspraken & Kassa Platform', street: 'Platformweg', houseNumber: '1', postalCode: '1000 AA', city: 'Amsterdam' };
  const ontvanger = invoice.recipientType === 'customer'
    ? store.customers.get(invoice.recipientId)
    : store.companies.get(invoice.recipientId);
  const totals = invoice.totals;
  const rows = invoice.lines.map(l => `<tr>
    <td>${esc(l.description)}</td><td>${l.qty}</td>
    <td>${euro(l.unitPriceCents)}</td><td>${l.vatRate}%</td>
    <td>${euro(Math.round(l.qty * l.unitPriceCents))}</td></tr>`).join('');
  const vatRows = Object.entries(totals.vatByRate)
    .map(([rate, cents]) => `<tr><td colspan="4">BTW ${rate}%</td><td>${euro(cents)}</td></tr>`).join('');
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8">
    <title>Factuur ${esc(invoice.number)}</title><link rel="stylesheet" href="css/style.css"></head>
    <body><main class="card">
    ${afzender.logoDataUrl ? `<img src="${afzender.logoDataUrl}" alt="logo" class="logo">` : ''}
    <h1>Factuur ${esc(invoice.number)}</h1>
    <p><strong>Van:</strong> ${esc(afzender.name)}, ${esc(afzender.street)} ${esc(afzender.houseNumber)}, ${esc(afzender.postalCode)} ${esc(afzender.city)}<br>
    <strong>Aan:</strong> ${esc(ontvanger.name)}, ${esc(ontvanger.street)} ${esc(ontvanger.houseNumber)}, ${esc(ontvanger.postalCode)} ${esc(ontvanger.city)}<br>
    <strong>Datum:</strong> ${esc(invoice.issuedAt)} — <strong>Vervalt:</strong> ${esc(invoice.dueAt)}</p>
    <table><thead><tr><th>Omschrijving</th><th>Aantal</th><th>Stukprijs</th><th>BTW</th><th>Bedrag</th></tr></thead>
    <tbody>${rows}
    <tr><td colspan="4"><strong>Subtotaal excl. BTW</strong></td><td>${euro(totals.exclCents)}</td></tr>
    ${vatRows}
    <tr><td colspan="4"><strong>Totaal incl. BTW</strong></td><td><strong>${euro(totals.inclCents)}</strong></td></tr>
    </tbody></table>
    <button class="btn" onclick="window.print()">Afdrukken</button>
    </main></body></html>`);
  w.document.close();
}
