# Ontwerp: Statisch prototype (GitHub Pages)

**Datum:** 2026-07-11
**Status:** Goedgekeurde route (optie A uit de brainstorm)
**Relatie:** klikbaar wegwerp-prototype van [2026-07-11-afspraak-kassa-design.md](2026-07-11-afspraak-kassa-design.md); de hoofdspec blijft het contract voor de echte Laravel-bouw.

## 1. Doel

De schermen en flows van de applicatie testbaar maken vóór de echte bouw, publiek
bereikbaar via een GitHub Pages-URL, zonder server. Feedback ophalen op de drie
portalen en de kernflows; niet bedoeld als productiecode.

## 2. Techniek

- **Puur statisch:** HTML, CSS en vanilla JavaScript (ES-modules). Geen buildstap,
  geen frameworks — de repo is direct als GitHub Pages te publiceren.
- **"Database":** localStorage, benaderd via één datalaag-module (`store.js`) met een
  API die bewust lijkt op de latere backend (bijv. `store.appointments.create(...)`).
  Eén seed-module vult bij eerste bezoek voorbeelddata (2 bedrijven, agenda's,
  klanten, afspraken in alle statussen, facturen betaald/onbetaald).
  Een "reset demo-data"-knop zet alles terug.
- **Simulaties:** e-mail, SMS en Mollie bestaan als zichtbare simulaties:
  - een **postvak-paneel** toont elke "verzonden" e-mail (bevestiging, herinnering,
    factuur met nep-PDF-weergave, betalingsherinnering, keuringsuitslag);
  - SMS-verificatie toont de code op het scherm in plaats van te versturen;
  - de betaallink leidt naar een **nep-Mollie-pagina** met een "Betaal"-knop die de
    factuur op betaald zet.
- **Structuur:** één pagina per portaal (`index.html` klant, `bedrijf.html`,
  `admin.html`) plus gedeelde modules (datalaag, slotgenerator, factuurberekening,
  UI-componenten). Portaalwissel via gewone links; "inloggen" is een gebruiker kiezen
  uit een lijst (geen echte auth).

## 3. Scope

Alle functionele flows uit de hoofdspec, gesimuleerd waar er een externe dienst zit:

1. Registratie klant en bedrijf incl. gesimuleerde e-mail-/SMS-verificatie en
   admin-keuring (wachtrij in het adminportaal).
2. Agenda's beheren: openingstijden, slotduur, blokkades; max 4 per bedrijf.
3. Boeken door de klant: bedrijvenlijst → agenda → weekweergave met vrije sloten
   (zelfde rekenregels als de hoofdspec: openingstijden × slotduur − afspraken
   − blokkades).
4. Afspraakstatussen (`scheduled`/`cancelled`/`completed`/`no_show`) incl.
   afzegtermijn voor de klant.
5. Facturen: opstellen (vanuit voltooide afspraak of los), regels met BTW,
   versturen, nep-betaling, annuleren, creditnota.
6. Rapportages: betaald/onbetaald, omzet per dag/week/maand/kwartaal/jaar,
   inactieve klanten X–Y dagen, admin-overzicht per bedrijf.
7. Herinneringen (afspraak + betaling): een "simuleer dagelijkse taken"-knop in het
   adminportaal voert de scheduler-logica uit en toont de resulterende mails in het
   postvak.

**Niet in het prototype:** echte auth/wachtwoorden, logo-herschaling (upload toont
het beeld gewoon), captcha/rate-limiting, PDF-generatie (factuur is een printbare
HTML-weergave).

## 4. Kwaliteit

Het prototype is wegwerpwerk, maar de **rekenlogica** (slotgenerator,
factuur-/BTW-totalen, statusovergangen, herinneringsregels) wordt geschreven als
losse pure functies met een klein testbestand (`tests.html` draait ze in de browser)
— die regels zijn namelijk de specificatie die de Laravel-bouw straks overneemt.
