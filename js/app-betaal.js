import { initStore, euro, nowStr, sendMail, esc } from './ui.js';

const store = initStore();
const id = Number(new URLSearchParams(location.search).get('invoice'));
const inv = store.invoices.get(id);
const box = document.getElementById('betaal');

if (!inv) {
  box.textContent = 'Factuur niet gevonden.';
} else if (inv.status === 'paid') {
  box.innerHTML = `<h1>Al betaald</h1><p>Factuur ${esc(inv.number)} is al voldaan.</p>`;
} else if (inv.status !== 'sent') {
  box.innerHTML = `<h1>Niet betaalbaar</h1><p>Factuur ${esc(inv.number)} heeft status ${esc(inv.status)}.</p>`;
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
