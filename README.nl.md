<!-- Generated from launch/locales/nl.json; run npm run docs:generate. -->
# App Canvas

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [한국어](README.ko.md) · [Nederlands](README.nl.md)

## Je hele UI. Eén canvas. Echte code.

Verken echte schermen, toestanden en interactieve flows op een zoombaar canvas, gebouwd en onderhouden met je coding agent.

**[Open de demo](https://tombelieber.github.io/app-canvas/) · [Voeg toe aan je repo](https://tombelieber.github.io/app-canvas/about/nl/start/) · [Releaseverhaal](https://tombelieber.github.io/app-canvas/about/nl/release/)**

## TL;DR

- Bekijk volledige geïmplementeerde schermen, benoemde toestanden en verbonden flows samen.
- Onderhoud één UI-implementatie. Je agent maakt fixtures, adapter en dekkingscontroles.
- Probeer 77 toestanden en 44 flows met synthetische data, zonder account of API-sleutel.

![Echte StoolSense-toestanden op het App Canvas-overzicht](docs/stoolsense-overview.jpg)

Echte demo: 77 toestanden, 44 flows en 121 afspeelbare items. Daaronder losse cases, geen 121 E2E-flows.

## Bekijk, gebruik en speel af

### Zoom uit om de app te begrijpen

Volledige schermen per pagina, zoeken, filters en inklapbare panelen. Flowlinks verplaatsen de camera naar hun bestemming.

### Zoom in om de echte UI te gebruiken

Browse vergrendelt bediening tijdens het schuiven. Kies een scherm en Interact om de oorspronkelijke code met tijdelijke data te bedienen.

### Druk op Demo om een flow uit te leggen

Speel succes, fouten en herstel af in één doorlopende appsessie, met actieaanwijzingen, bijschriften, pauze, snelheid en tijdlijn.

![Echte weergave na mislukte offline opslag met behoud van het concept](docs/stoolsense-playback.jpg)

Echte fout- en herstel-UI. Afspelen voert vastgelegde acties en controles uit; een getekende verbinding is geen test.

## Van bestaande repo naar interactief canvas

Geef de integratie aan een agent die bestanden kan lezen, wijzigen en opdrachten uitvoeren. Bestaand Storybook of een handmatige schermlijst is niet nodig. Installatie alleen vult het canvas niet.

### Plak dit in je agent

```text
Read https://github.com/tombelieber/app-canvas/blob/v0.11.0/AGENT_GUIDE.md and add a completely populated App Canvas to this repository. Discover all screens, components, variants, states and navigation from the whole application source. Use original UI code. Create the missing synthetic fixtures and render harnesses. Reconcile an independent source inventory with rendered cases and source-linked runtime checks. Add checked happy, failure and recovery journeys. Run --complete against the original source root. Continue until the full landscape is populated and verified; report genuine blockers as incomplete. Keep production sessions, credentials and real user data out of previews.
```

### 1. Installeer het gedeelde gereedschap

Gebruik Node.js 22+ en de pakketbeheerder en lockfile van je project. Installeer de vastgezette GitHub-release en de browser. Voeg bij npm 12 alleen --allow-git=root toe als deze directe Git-afhankelijkheid wordt geblokkeerd; wijzig geen globaal beleid.

```sh
npm install --save-dev github:tombelieber/app-canvas#v0.11.0
npx app-canvas browsers
```

### 2. Inventariseer vóór je cases kiest

Voer discover uit op de volledige app-root. De agent bekijkt elke bronregio en kandidaat, lost pending op en inventariseert semantische toestanden onafhankelijk van de catalog. Blokkades blijven zichtbaar.

```sh
npx app-canvas discover --source-root . --out .artifacts/app-canvas/inventory.json
npx app-canvas pending --inventory .artifacts/app-canvas/inventory.json
```

### 3. Render de oorspronkelijke UI met fixtures

Maak config, catalog, synthetische fixtures, preview entry en journeys in ui-review. De adapter importeert echte pagina’s, providers en stijlen. Vervang data en afhankelijkheden, niet de UI; weiger onbekende netwerkverzoeken.

### 4. Verifieer toestanden en interacties

Neem normaal, leeg, laden, fouten, toegang geweigerd, dialogen en herstel op. Controleer elke case en echte bediening in doorlopende flows. Vergelijk inventory, brongebonden assertions en routes; slaag voor --complete op dezelfde root.

```sh
npx app-canvas --config ui-review/canvas.config.mjs --check
npx app-canvas --config ui-review/canvas.config.mjs --verify
npx app-canvas --config ui-review/canvas.config.mjs --complete --source-root .
```

### 5. Beoordeel en onderhoud vanuit de code

Start ui:review, bekijk overzicht en toestandsgraaf en speel een flow af. Laat de agent echte app-code wijzigen. Bestaande previews herbouwen; nieuwe routes en toestanden vragen updates van inventory, fixtures en journeys. Vereis de volledige controle vóór overdracht.

```sh
npm run ui:review
```


### Wat in jouw toepassing blijft

Het gedeelde pakket beheert viewer, CLI en skill. Je repo beheert adapter, fixtures, onafhankelijke inventory, catalog en interactiecontroles. Begin met het uitvoerbare React/Vite-voorbeeld; andere stacks hebben een eigen adapter nodig.

[Agent guide](https://github.com/tombelieber/app-canvas/blob/v0.11.0/AGENT_GUIDE.md) · [React/Vite](https://github.com/tombelieber/app-canvas/tree/v0.11.0/examples/react-vite)

### Optionele agentskill

Codex en Claude Code kunnen de meegeleverde skill installeren. Andere agents lezen AGENT_GUIDE.md rechtstreeks. De runtime roept geen modellen aan en vraagt geen API-sleutel; je eigen agent heeft eigen kosten en rechten.

```sh
npx app-canvas install --target both
```

## Reikwijdte en beperkingen

- Web gebruikt echte HTML/CSS en oorspronkelijke JavaScript voor interacties. UIKit, SwiftUI en Android vereisen harnesses en bewijs uit de oorspronkelijke runtime; een opname is geen interactieve native app.
- Dekking verbindt beoordeelde broncode met cases en ontdekt niet automatisch elke bedrijfsconditie. UI-controles kwalificeren geen productiebackend, klinische juistheid of modelprecisie.
- De viewerbediening is momenteel Traditioneel Chinees; deze pagina’s en gidsen zijn meertalig. De demo is een bevroren synthetische frontend; echte integraties volgen je code. Prestaties op een fysieke iPad zijn niet gemeten.

Synthetische data · geen app-backend · geen account · geen API-sleutel

[Safari-techniekartikel](https://tomtang3.ai/blog/app-canvas-safari-rendering/)

Uitgebreide API, native aanpak, alternatieven en releaseonderhoud staan in de Engelse README en agentgids. [English README](README.md) · [MIT](LICENSE)
