# Ontwerp: Klantpagina's per bedrijf

**Datum:** 2026-07-12
**Status:** Goedgekeurd ontwerp
**Relatie:** wijzigt het klantmodel van [2026-07-11-afspraak-kassa-design.md](2026-07-11-afspraak-kassa-design.md)
(de hoofdspec is op deze wijziging bijgewerkt) en wordt doorgevoerd in het statische prototype.

## 1. Aanleiding en doel

Het centrale klant-account (één platformlogin, bedrijvenlijst, boeken bij elk bedrijf)
vervalt. In plaats daarvan krijgt elk bedrijf een eigen, gebrande klantpagina die in de
eigen website ge-embed kan worden. Een klant ziet altijd uitsluitend zijn afspraken en
berichten van één bedrijf. Boeken is laagdrempelig (gegevens valideren, niet verifiëren);
beheren en berichten lezen vereist wél verificatie van e-mail of telefoonnummer.

## 2. Klantmodel

- `customers` krijgt een `company_id`; dezelfde persoon bij twee bedrijven bestaat als
  twee losse records. Geen wachtwoord, geen registratie vooraf, geen
  `email_verified_at`/`phone_verified_at` als toegangspoort.
- Bij het boeken wordt de klant **binnen het bedrijf** gematcht op e-mailadres of
  telefoonnummer; bestaat hij al, dan wordt dat record gebruikt en worden de overige
  gegevens bijgewerkt. Anders wordt een nieuw record aangemaakt.
- **Let op voor de Laravel-bouw:** bij een match mag het *andere* contactkanaal niet
  ongeverifieerd overschreven worden (wie het e-mailadres van een klant kent, zou anders
  zijn eigen telefoonnummer op dat record kunnen zetten en via de code-flow toegang
  krijgen). Werk bij een match alleen niet-identiteitsvelden (naam) bij; een afwijkend
  e-mail/telefoon-paar wordt een nieuw klantrecord. In het prototype is dit risico
  niet nagebootst.

## 3. URL's en branding

- Elk bedrijf krijgt bij aanmaak een **uniek, niet-raadbaar publiek ID** (kort
  willekeurig token, bijv. `k7f3q9w2`), opgeslagen op het bedrijfsrecord.
- **Klantpagina** — prototype: `index.html?bedrijf=<id>`; Laravel: `/b/{publicId}`.
  Volledig gebrand met logo en naam van het bedrijf; geen platformnavigatie en geen
  bedrijvenlijst. Zonder of met ongeldig ID toont de pagina een neutrale uitleg
  (in het prototype aangevuld met demo-links naar de seed-bedrijven).
- **Bedrijfsportaal** — prototype: `bedrijf.html?bedrijf=<id>` opent direct het portaal
  van dat bedrijf; de bestaande kiezer blijft de fallback zonder ID. Laravel:
  `/bedrijf/{publicId}`.
- Het publieke ID is per definitie openbaar (het staat in de embed-code); de
  `/bedrijf/{publicId}`-route beschermt zichzelf dus met authenticatie en steunt
  nooit op geheimhouding van het ID.

## 4. Iframe-embedding

- De klantpagina is embed-vriendelijk: compacte kop, geen externe navigatie, responsief
  binnen de beschikbare breedte.
- Het bedrijfsportaal toont onder instellingen een kant-en-klaar embed-fragment
  (`<iframe src="…?bedrijf=<id>" …>`) om in de eigen website te plakken.
- Laravel: geen `X-Frame-Options` op de klantroutes en CSP `frame-ancestors *` op
  uitsluitend die routes; de rest van de applicatie blijft frame-beveiligd.

## 5. Boeken: valideren, niet verifiëren

- Eén afspraak per boeking; reeksen/terugkerende afspraken blijven buiten scope.
- Formulier: naam, e-mailadres, telefoonnummer → uitsluitend formaatvalidatie
  (geldig e-mailadres, geldig Nederlands nummer) → slot kiezen → afspraak staat direct
  vast → bevestigingsbericht (mail; in het prototype gesimuleerd in het postvak-paneel).
- Er wordt bij het boeken géén verificatielink of SMS-code verstuurd.

## 6. Beheren en berichten: wél verifiëren

- Tab "Mijn afspraken & berichten" op de klantpagina: de klant voert zijn e-mailadres
  **of** telefoonnummer in → er wordt een code verzonden (mail of SMS; in het prototype
  zichtbaar gesimuleerd) → na correcte invoer heeft de klant sessietoegang tot
  uitsluitend zijn eigen gegevens bij dit bedrijf:
  - **afspraken:** afzeggen (binnen de afzegtermijn) en opnieuw boeken;
  - **berichten:** alle aan hem gestuurde communicatie van dit bedrijf
    (bevestigingen, herinneringen, facturen);
  - **facturen:** inzien en betalen via de betaallink.
- Codes verlopen en kennen een pogingenlimiet. In de Laravel-bouw gelden rate-limits
  per IP en per telefoonnummer/e-mailadres (SMS-kosten, misbruik); de captcha- en
  +31-maatregelen uit de hoofdspec verschuiven van registratie naar dit beheer-moment.

## 7. Overige gevolgen

- Bedrijvenlijst en klantregistratie (incl. verificatieflow) verdwijnen uit het
  klantportaal.
- Facturen aan klanten blijven identiek werken; de ontvanger is voortaan het
  per-bedrijf-klantrecord. Betalen loopt via de betaallink in het bericht.
- Bedrijfsregistratie, e-mail-/SMS-verificatie van bedrijven, admin-keuring en het
  adminportaal blijven ongewijzigd.
- De customer-guard uit de hoofdspec vervalt; daarvoor in de plaats komt een
  code-gebaseerde sessie per bedrijf.

## 8. Teststrategie (aanvulling)

- Boeken als nieuwe én als bestaande klant (matching op e-mail/telefoon binnen bedrijf).
- Formaatvalidatie bij boeken; geen verificatie vereist.
- Code-flow: juiste/onjuiste code, verlopen code, pogingenlimiet; toegang toont
  uitsluitend data van het bedrijf uit de URL.
- Afzeggen binnen/buiten de afzegtermijn via de code-sessie.
- Onbekend of ontbrekend bedrijfs-ID toont de neutrale pagina.
