<!-- Generated from launch/locales/de.json; run npm run docs:generate. -->
# App Canvas

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [한국어](README.ko.md) · [Nederlands](README.nl.md)

## Deine ganze UI. Eine Zeichenfläche. Echter Code.

Erkunde echte App-Seiten, Zustände und interaktive Abläufe auf einer zoombaren Fläche, erstellt und gepflegt mit deinem Coding-Agenten.

**[Demo öffnen](https://tombelieber.github.io/app-canvas/) · [Zum Repository hinzufügen](https://tombelieber.github.io/app-canvas/about/de/start/) · [Release-Artikel](https://tombelieber.github.io/app-canvas/about/de/release/)**

## TL;DR

- Sieh vollständige implementierte Seiten, benannte Zustände und verbundene Abläufe zusammen.
- Eine UI-Implementierung. Dein Agent erstellt Fixtures, Adapter und Abdeckungsprüfungen.
- Teste 77 Zustände und 44 Abläufe mit synthetischen Daten, ohne Anmeldung oder API-Schlüssel.

![Echte StoolSense-Zustände in der App-Canvas-Übersicht](docs/stoolsense-overview.jpg)

Echte Demo: 77 Zustände, 44 Abläufe, 121 abspielbare Einträge. Darunter einzelne Fälle, nicht 121 E2E-Abläufe.

## Überblicken, bedienen, abspielen

### Herauszoomen und die App verstehen

Vollständige Seiten, nach Seite gruppiert, mit Suche, Filtern und einklappbaren Panels. Ablauf-Links bewegen die Kamera zum Ziel.

### Hineinzoomen und die echte UI bedienen

Browse sperrt Bedienelemente zum Verschieben. Wähle eine Seite und Interact, um ihren Originalcode mit Wegwerfdaten zu bedienen.

### Mit Demo einen Ablauf erklären

Erfolg, Fehler und Wiederherstellung laufen in einer fortlaufenden App-Sitzung, mit Aktionshinweisen, Texten, Pause, Tempo und Schritt-Zeitleiste.

![Echte Wiedergabe nach fehlgeschlagenem Offline-Speichern mit erhaltenem Entwurf](docs/stoolsense-playback.jpg)

Echte Fehler- und Wiederherstellungs-UI. Die Wiedergabe führt definierte Aktionen und Prüfungen aus; eine gezeichnete Kante ist kein Test.

## Vom vorhandenen Repository zur interaktiven Übersicht

Beauftrage einen Agenten, der Dateien lesen, ändern und Befehle ausführen kann. Vorhandenes Storybook oder manuelle Seitenlisten sind nicht nötig. Die Installation allein füllt die Übersicht nicht.

### Diesen Auftrag an den Agenten geben

```text
Read https://github.com/tombelieber/app-canvas/blob/v0.13.1/AGENT_GUIDE.md and add a completely populated App Canvas to this repository. Discover all screens, components, variants, states and navigation from the whole application source. Use original UI code. Create the missing synthetic fixtures and render harnesses. Reconcile an independent source inventory with rendered cases and source-linked runtime checks. Add checked happy, failure and recovery journeys. Group by actual page and feature, connect checked flows, deduplicate repeated captures and resume checkpoints. Run --ui-complete against the original source root; keep the stricter --complete source audit separate and unchanged. Continue until the full landscape is populated and verified; report genuine blockers as incomplete. Keep production sessions, credentials and real user data out of previews.
```

### 1. Gemeinsames Werkzeug installieren

Nutze Node.js 22+ sowie Paketverwaltung und Lockfile des Projekts. Installiere das feste GitHub-Release und den Browser. Blockiert npm 12 diese direkte Git-Abhängigkeit, ergänze nur dann --allow-git=root; ändere keine globale Richtlinie. Bis zur Veröffentlichung von v0.13.0 benötigen diese UI-Befehle einen qualifizierten Entwicklungscommit.

```sh
npm install --save-dev github:tombelieber/app-canvas#v0.13.1
npx app-canvas browsers
```

### 2. Erst inventarisieren, dann Fälle wählen

Führe plan im gesamten ursprünglichen App-Repository aus. Prüfe alle Dateien, UI-Anker, UI-relevanten Abhängigkeiten und die tatsächliche Navigation. Erfasse Screens und Zustände unabhängig vom Katalog; ungeklärte UI bleibt offen.

```sh
npx app-canvas plan --source-root . --out ui-review/ui-inventory.json
npx app-canvas status --inventory ui-review/ui-inventory.json
```

### 3. Original-UI mit Fixtures rendern

Erstelle Config, Catalog, synthetische Fixtures, Preview-Einstieg und Journeys unter ui-review. Der Adapter importiert echte Seiten, Provider und Styles. Ersetze Daten und Abhängigkeiten, nicht die UI; lehne unbekannte Netzwerkanfragen ab.

### 4. Zustände und Interaktionen prüfen

Erfasse Normal-, Leer-, Lade-, Fehler-, Zugriffs-, Dialog- und Wiederherstellungszustände. Prüfe jeden Fall und echte Bedienelemente in fortlaufenden Abläufen. Gleiche Inventory, quellbezogene Assertions und Routen ab; bestehe --ui-complete im selben Stamm. --complete bleibt ein separates strenges Audit des gesamten Quellcodes. Offene Audit-Punkte sind keine Anzahl fehlender Screens.

```sh
npx app-canvas populate --config ui-review/canvas.config.mjs --source-root . --verify
```

### 5. Aus dem Quellcode pflegen

Starte ui:review, prüfe Übersicht und Zustandsgraph und spiele einen Ablauf ab. Lass den Agenten den echten App-Code ändern. Bestehende Vorschauen werden neu gebaut; neue Routen und Zustände brauchen Inventory-, Fixture- und Journey-Updates. Vor Übergabe gilt die vollständige Prüfung.

```sh
npm run ui:review
```


### Was in deiner App bleibt

Das gemeinsame Paket enthält Viewer, CLI und Skill. Dein Repository pflegt Adapter, Fixtures, unabhängiges Inventory, Catalog und Interaktionsprüfungen. Starte mit dem ausführbaren React/Vite-Beispiel; andere Stacks brauchen eigene Adapter.

[Agent guide](https://github.com/tombelieber/app-canvas/blob/v0.13.1/AGENT_GUIDE.md) · [React/Vite](https://github.com/tombelieber/app-canvas/tree/v0.13.1/examples/react-vite)

### Optionaler Agent-Skill

Codex und Claude Code können den enthaltenen Skill installieren. Andere Agenten lesen AGENT_GUIDE.md direkt. Die Laufzeit ruft keine Modelle auf und braucht keinen API-Schlüssel; dein Agent hat eigene Kosten und Berechtigungen.

```sh
npx app-canvas install --target both
```

## Umfang und Grenzen

- Web-Vorschauen nutzen echtes HTML/CSS und Original-JavaScript bei Interaktionen. UIKit, SwiftUI und Android brauchen Harnesses und Nachweise aus der ursprünglichen Laufzeit; ein Bild ist keine interaktive native App.
- Abdeckung ist eine geprüfte Zuordnung von Quellen zu Fällen, keine automatische Erkennung jeder Geschäftsbedingung. UI-Prüfungen qualifizieren weder Produktions-Backends noch klinische oder Modellgenauigkeit.
- Viewer: standardmäßig Englisch, 11 Sprachen. Die öffentliche Demo ist ein eingefrorenes synthetisches Frontend; lokale Integrationen folgen dem Quellcode. Physische iPad-Leistung wurde nicht gemessen.

Synthetische Daten · kein App-Backend · keine Anmeldung · kein API-Schlüssel

[Safari-Technikartikel](https://tomtang3.ai/blog/app-canvas-safari-rendering/)

Detaillierte API, native Abläufe, Alternativen und Release-Pflege stehen im englischen README und Agent-Guide. [English README](README.md) · [MIT](LICENSE)
