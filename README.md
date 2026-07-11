# Afspraken & Kassa — statisch prototype

Klikbaar prototype van de afspraken- en kassa-applicatie. Puur statisch
(HTML/JS/localStorage); e-mail, SMS en Mollie zijn zichtbare simulaties.

## Lokaal bekijken
Open `index.html` (klant), `bedrijf.html` of `admin.html` in de browser,
of serveer de map: `python -m http.server` en ga naar http://localhost:8000

## Tests
- Node: `node tests/run.mjs`
- Browser: open `tests.html`

## Publiceren op GitHub Pages
Settings → Pages → Source: `main`, map `/ (root)`.
