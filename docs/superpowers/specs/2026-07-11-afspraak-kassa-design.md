# Ontwerp: Afspraken- en kassa-applicatie (SaaS)

**Datum:** 2026-07-11
**Status:** Goedgekeurd ontwerp, klaar voor implementatieplan

## 1. Doel en context

Een SaaS-platform waarop bedrijven zich abonneren om 1 tot 4 online agenda's te voeren.
Klanten van die bedrijven boeken afspraken op vrije tijdsloten. Na een voltooide afspraak
stuurt het bedrijf een factuur die via Mollie betaald kan worden. De platformbeheerder
keurt bedrijven, stuurt zelf facturen aan bedrijven en ziet platform-brede rapportages.

**Kernbeslissingen (uit de brainstorm):**

| Onderwerp | Beslissing |
|---|---|
| Exploitatie | SaaS-platform; bedrijven zijn tenants, platformbeheerder factureert bedrijven handmatig |
| Agenda's | Generieke tijdslot-kalenders (geen dienstencatalogus); vaste slotduur + openingstijden per agenda |
| Klantmodel | Eén platform-account per klant; boeken bij elk toegelaten bedrijf |
| Communicatie V1 | Alleen e-mail; WhatsApp later via notificatie-abstractie |
| Validatie | E-mail via verificatielink; telefoon via SMS-code; bedrijven daarnaast handmatig gekeurd door admin (adres + KVK) |
| Facturatie | Factuurregels met BTW (21/9/0), PDF-bijlage, Mollie-betaallink; zelfde module voor platform→bedrijf |
| Mollie | Eigen Mollie-account (API-sleutel) per bedrijf; platform gebruikt eigen sleutel voor facturen aan bedrijven |
| Rollen | Eén login per bedrijf; aparte guards voor admin, bedrijf en klant |
| Stack | PHP 8.3, Laravel 11, MySQL 8, Blade + Livewire (monoliet, benadering A) |

## 2. Architectuur en portalen

Eén Laravel-applicatie met drie portalen, gescheiden via route-prefixen en middleware:

- **`/admin`** — platformbeheerder: keuringswachtrij bedrijven, platformfacturen, rapportages per bedrijf, inzicht in mislukte achtergrondtaken.
- **`/bedrijf`** — bedrijfsportaal: agenda's, openingstijden en blokkades (vakantie, feestdagen) beheren, afspraken beheren en van status wisselen, facturen opstellen/versturen/crediteren, eigen rapportages, Mollie-sleutel en instellingen (o.a. afzegtermijn).
- **`/`** — publiek + klantportaal: bedrijvenlijst, registratie, boeken, eigen afspraken en facturen inzien en betalen.

**Authenticatie:** drie Laravel-guards (`admin`, `company`, `customer`) met elk een eigen
tabel. Verificatie-eisen zitten in middleware: een account dat nog niet volledig
gevalideerd is kan inloggen maar komt niet verder dan de "verificatie afronden"-pagina.
Een bedrijf is pas zichtbaar/bruikbaar als e-mail én telefoon geverifieerd zijn én de
admin heeft goedgekeurd.

**Achtergrondwerk:** Laravel-queues met database-driver (mail, PDF-generatie, logo
herschalen). De Laravel-scheduler draait twee dagelijkse taken: afspraakherinneringen
(24 uur vóór aanvang) en betalingsherinneringen voor vervallen facturen.
**Notificaties:** één `NotificationService`-interface; V1 bevat alleen het
e-mailkanaal, een WhatsApp-kanaal klikt daar later in zonder wijziging van aanroepende code.

## 3. Datamodel

Bedragen als integers in centen; tijden in UTC; weergave in Europe/Amsterdam.

**Accounts**
- `admins` — naam, e-mail, wachtwoord.
- `companies` — naam, adresvelden (straat, huisnummer, postcode, plaats), whatsapp-telefoonnummer, e-mail, KVK-nummer, logopad, wachtwoord, `email_verified_at`, `phone_verified_at`, `approved_at`, afkeurreden, Mollie API-sleutel (versleuteld), afzegtermijn-uren (default 24).
- `customers` — naam, adresvelden, whatsapp-telefoonnummer, e-mail, wachtwoord, `email_verified_at`, `phone_verified_at`.
- `phone_verifications` — polymorf (bedrijf/klant), code, vervaltijd, pogingenteller.

**Agenda & afspraken**
- `calendars` — `company_id`, naam, slotduur (minuten), actief-vlag. Max 4 per bedrijf (applicatieregel).
- `calendar_opening_hours` — `calendar_id`, weekdag, begintijd, eindtijd (meerdere blokken per dag mogelijk).
- `calendar_blocks` — `calendar_id`, van-datum/tijd, tot-datum/tijd, reden (vakantie, feestdag, privé). Binnen een blokkade worden geen sloten aangeboden; bestaande afspraken in de periode worden getoond zodat het bedrijf ze kan afzeggen.
- `appointments` — `calendar_id`, `customer_id`, `starts_at`, `ends_at`, `status` enum (`scheduled` | `cancelled` | `completed` | `no_show`), tijdstempels per statuswissel, `reminder_sent_at`. Unieke index op `(calendar_id, starts_at)` voor actieve (niet-geannuleerde) afspraken tegen dubbelboekingen.

**Facturatie** (één model voor beide richtingen)
- `invoices` — `issuer_company_id` (NULL = platform is afzender), polymorfe ontvanger (`recipient_type` klant/bedrijf + `recipient_id`), optionele `appointment_id`, factuurnummer (opeenvolgend per afzender per jaar, formaat `JJJJ-NNNN`), `status` (`draft` | `sent` | `paid` | `cancelled`), `issued_at`, `due_at`, `paid_at`, `mollie_payment_id`, `credited_invoice_id` (verwijzing naar de gecrediteerde factuur als dit een creditnota is), `reminder_count` en `last_reminder_at` (betalingsherinneringen), totalen (excl. BTW, BTW-bedrag per tarief, incl. BTW).
- `invoice_lines` — omschrijving, aantal, stukprijs, BTW-tarief (21/9/0). Totalen worden berekend en bevroren bij versturen.

## 4. Kernflows

### Registratie en validatie
1. **Klant:** formulier (naam, adres, whatsapp-nummer, e-mail, wachtwoord) → verificatielink per e-mail → SMS-code voor telefoon (Twilio Verify, achter een eigen interface zodat de provider verwisselbaar blijft). Pas na beide stappen kan er geboekt worden.
2. **Bedrijf:** zelfde velden + KVK-nummer + logo → e-mail- en SMS-verificatie → handmatige keuring door admin (wachtrij met naam, adres, KVK). Goed-/afkeuring wordt gemaild; afkeuring met reden.
3. **Logo:** queue-job schaalt naar 300×300 px (Intervention Image), passend binnen het kader met witruimte (geen vervorming).

### Boeken
Klant kiest bedrijf → agenda → weekweergave met vrije sloten. Sloten worden live
berekend: openingstijden opgedeeld in slotduur, minus bestaande actieve afspraken,
minus blokkades (`calendar_blocks`), alleen toekomstige tijden. Boeking in een
databasetransactie; bij een race op hetzelfde slot vangt de unieke index de tweede
boeking af met een nette melding. Bevestigingsmail naar klant en bedrijf.

Een dagelijkse scheduler-taak stuurt 24 uur vóór aanvang een herinnering aan de klant
(`reminder_sent_at` voorkomt dubbele verzending) — dit drukt het aantal no-shows.

### Afspraakstatussen
`scheduled` → (`cancelled` | `completed` | `no_show`). Het bedrijf kan elke
overgang op elk moment zetten; de klant kan alleen naar `cancelled`, en uitsluitend tot
de afzegtermijn (default 24 uur) vóór aanvang.
Elke statuswissel triggert een notificatie naar de andere partij.
Vanuit `completed` kan het bedrijf met één klik een factuur starten.

### Factureren en betalen
1. Factuur start als `draft` (vanuit voltooide afspraak — klant voorgevuld — of los), regels vrij bewerkbaar.
2. **Versturen:** factuurnummer toegekend, totalen bevroren, PDF gegenereerd (dompdf, met bedrijfslogo), mail met PDF + betaallink naar de ontvanger. Status → `sent`.
3. **Betalen:** betaallink → betaalpagina in de app → bij klik op "Betalen" wordt de Mollie-betaling aangemaakt (niet eerder; Mollie-links verlopen) → redirect naar Mollie.
4. **Webhook:** haalt de betaling altijd op bij de Mollie-API (payload nooit vertrouwen), idempotent. Bij `paid`: status → `paid`, `paid_at` gezet, bevestigingsmail naar beide partijen.
5. Bedrijf zonder Mollie-sleutel: mail bevat alleen de PDF; het bedrijf kan de factuur handmatig op betaald zetten (overschrijving/contant).
6. Platform→bedrijf: identieke flow met de platform-Mollie-sleutel en de admin als opsteller.
7. **Betalingsherinneringen:** een dagelijkse scheduler-taak stuurt bij `sent`-facturen voorbij `due_at` automatisch een herinnering met verse betaallink, 7 en 14 dagen na de vervaldatum (`reminder_count`/`last_reminder_at` sturen dit aan). Daarna is het aan de afzender.
8. **Corrigeren en crediteren:** een `draft` is vrij bewerkbaar of te verwijderen. Een `sent`-factuur is onveranderlijk (sluitende nummering); fouten worden hersteld door de factuur te **annuleren** (status `cancelled`, alleen zolang niet betaald) of door een **creditnota** te genereren — een nieuwe factuur met negatieve regels en een eigen nummer, via `credited_invoice_id` gekoppeld aan het origineel en per mail met PDF aan de ontvanger gestuurd. Rapportages tellen creditnota's mee als negatieve omzet.

## 5. Rapportages

Rechtstreekse SQL-aggregaties; geen aparte rapportagetabellen in V1.

**Bedrijfsportaal**
1. Voltooide afspraken met betaalstatus: betaald / factuur openstaand / nog geen factuur.
2. Facturenoverzicht betaald/onbetaald, met filters op periode en status.
3. Omzet per dag, week, maand, kwartaal, jaar (op basis van `paid_at`).
4. Inactieve klanten: klanten van wie de laatste afspraak tussen X en Y dagen geleden is (X en Y invoervelden).

**Adminportaal**
1. Aantal afspraken en omzet per bedrijf per periode.
2. Betaald/onbetaald-overzicht van platformfacturen.

## 6. Foutafhandeling

- Queue-jobs: automatische retries met exponentiële backoff; blijvend falen komt in `failed_jobs`, zichtbaar voor de admin.
- SMS-verificatie: "code opnieuw sturen" met rate-limiting; codes verlopen.
- **SMS-misbruik (SMS-pumping):** elke SMS kost geld, dus registratie en codeverzoeken krijgen een captcha, strikte rate-limits per IP én per telefoonnummer, en V1 accepteert alleen Nederlandse nummers (+31).
- Mollie-webhook: idempotent, verifieert altijd bij de API.
- Dubbelboeking: afgevangen door de unieke index (databaseniveau) + nette foutmelding.
- Mail-/SMS-provider en Mollie zitten achter interfaces zodat storingen lokaal af te handelen en te testen zijn.

## 7. Teststrategie

- **Feature-tests (Pest)** per portaal: registreren → valideren → keuren (incl. rate-limits op SMS-verzoeken); boeken inclusief dubbelboek-race en blokkades; statuswissels incl. afzegtermijn; factuur `draft` → `sent` → webhook → `paid`; annuleren en crediteren; scheduler-taken voor afspraak- en betalingsherinneringen (geen dubbele verzending).
- **Unit-tests:** slotgenerator (openingstijden × slotduur × bestaande afspraken × blokkades), factuur-/BTW-totalen incl. negatieve creditnotaregels, toegestane statusovergangen.
- **Fakes:** Mollie, SMS-provider en mail worden gemockt via hun interfaces / Laravel-fakes.

## 8. Buiten scope V1 (bewust)

- WhatsApp-kanaal (abstractie ligt klaar).
- Meerdere gebruikers/rollen per bedrijf.
- Automatische abonnementsfacturatie platform→bedrijf.
- Terugkerende afspraken, wachtlijsten, agenda-synchronisatie (iCal-feed is de eerste kandidaat voor V1.1).
