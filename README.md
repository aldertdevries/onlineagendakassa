# Afspraken & Kassa — statisch prototype

Klikbaar prototype van de afspraken- en kassa-applicatie. Puur statisch
(HTML/JS/localStorage); e-mail, SMS en Mollie zijn zichtbare simulaties.

## Lokaal bekijken
Serveer de map (ES-modules vereisen http): `node dev-server.mjs` en ga naar
http://localhost:8000 — `index.html` (klant), `bedrijf.html` of `admin.html`.

## Demo-script
1. **Klant** (`index.html`): registreer een klant, klik de e-maillink-simulatie,
   voer de getoonde SMS-code in en boek een slot bij Salon Zonnig.
2. **Bedrijf** (`bedrijf.html`): kies Salon Zonnig, zet de afspraak op Voltooid,
   klik "→ Factuur maken", vul een regel in en verstuur.
3. **Klant**: open "Mijn facturen" → Betalen → nep-Mollie-pagina → betaald.
4. **Bedrijf**: maak een creditnota of annuleer een factuur; markeer een factuur
   van Fysio Vitaal (geen Mollie) handmatig als betaald; voeg een blokkade toe
   en zie de sloten in het klantportaal verdwijnen.
5. **Admin** (`admin.html`): keur "Kapper Nieuw" goed of af, stuur een
   platformfactuur, klik "▶ Simuleer dagelijkse taken" en bekijk de rapportages.
   "↺ Reset demo-data" zet alles terug.

## Beperkingen van het prototype
- Geen echte authenticatie: "inloggen" is een gebruiker kiezen in de kiezer.
- E-mail, SMS en Mollie zijn zichtbare simulaties (postvak-paneel, code op
  het scherm, nep-betaalpagina); er wordt niets echt verstuurd of afgeschreven.
- Het logo wordt niet echt herschaald naar 300×300 (alleen zo weergegeven).
- De factuur-"PDF" is een printbare HTML-weergave.
- Data staat in localStorage: per browser, per apparaat.

## Tests
- Node: `node tests/run.mjs`
- Browser: open `tests.html`

## Publiceren op GitHub Pages
Settings → Pages → Source: `main`, map `/ (root)`.
