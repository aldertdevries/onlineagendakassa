# Afspraken & Kassa — statisch prototype

Klikbaar prototype van de afspraken- en kassa-applicatie. Puur statisch
(HTML/JS/localStorage); e-mail, SMS en Mollie zijn zichtbare simulaties.

## Lokaal bekijken
Serveer de map (ES-modules vereisen http): `node dev-server.mjs` en ga naar
http://localhost:8000 — `index.html` (klant), `bedrijf.html` of `admin.html`.

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

## Tests
- Node: `node tests/run.mjs`
- Browser: open `tests.html`

## Publiceren op GitHub Pages
Settings → Pages → Source: `main`, map `/ (root)`.
