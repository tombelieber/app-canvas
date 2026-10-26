<!-- Generated from launch/locales/it.json; run npm run docs:generate. -->
# Agent Canvas

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [한국어](README.ko.md) · [Nederlands](README.nl.md)

## Il tuo agente costruisce.
Tu dai forma al prossimo passo.

Uno spazio leggero per vedere, provare e migliorare l’app del tuo agente. Esplora schermate reali, indica cosa cambiare e continua dal codice sorgente.

**[Apri la demo](https://agent-canvas-app.pages.dev/demo/?lang=en) · [Inizia gratis](https://agent-canvas-app.pages.dev/about/it/start/) · [Articolo di lancio](https://agent-canvas-app.pages.dev/about/it/release/)**

Demo in inglese

## Per costruire, verificare e migliorare

- Visualizza insieme schermate complete, stati nominati e flussi implementati.
- Mantieni una sola implementazione UI. L’agente crea fixture, adapter e verifiche di copertura.
- Prova 77 stati e 44 flussi con dati sintetici, senza account né chiave API.



## Esplora, interagisci, riproduci

### Allontanati per capire l’app

Schermate complete raggruppate per pagina, ricerca, filtri e pannelli richiudibili. I link dei flussi spostano la visuale alla destinazione.

### Avvicinati per usare la UI reale

Browse blocca i controlli durante lo spostamento. Seleziona una schermata e Interact per usare il codice originale con dati temporanei.

### Indica esattamente cosa cambiare

Seleziona una schermata o un elemento UI, aggiungi la richiesta e copia un riferimento per il tuo agente. Chiedigli di modificare il codice; le anteprime collegate al sorgente si ricostruiscono.



## Da un repository esistente a una canvas interattiva

Affida l’integrazione a un agente che legge, modifica ed esegue comandi. Non servono Storybook o elenchi manuali di schermate. L’installazione da sola non popola la canvas.

### Incolla nel tuo agente

```text
Read https://github.com/tombelieber/app-canvas/blob/v0.16.1/AGENT_GUIDE.md and add a completely populated Agent Canvas to this repository. Discover all screens, components, variants, states and navigation from the whole application source. Use original UI code. Create the missing synthetic fixtures and render harnesses. Reconcile an independent source inventory with rendered cases and source-linked runtime checks. Add checked happy, failure and recovery journeys. Group by actual page and feature, connect checked flows, deduplicate repeated captures and resume checkpoints. Run --ui-complete against the original source root; keep the stricter --complete source audit separate and unchanged. Continue until the full landscape is populated and verified; report genuine blockers as incomplete. Keep production sessions, credentials and real user data out of previews.
```

### 1. Installa lo strumento condiviso

Usa Node.js 22+ e package manager e lockfile del progetto. Installa la release GitHub fissata e il browser. Con npm 12 aggiungi --allow-git=root solo se blocca questa dipendenza Git diretta; non modificare le regole globali.

```sh
npm install --save-dev github:tombelieber/app-canvas#v0.16.1
npx agent-canvas browsers
```

### 2. Inventaria prima di scegliere i casi

Esegui plan sull’intero repository originale. Esamina ogni file, ancoraggio UI, dipendenza che influisce sulla UI e navigazione reale. Elenca schermate e stati indipendentemente dal catalogo; mantieni visibili le UI irrisolte.

```sh
npx agent-canvas plan --source-root . --out ui-review/ui-inventory.json
npx agent-canvas status --inventory ui-review/ui-inventory.json
```

### 3. Renderizza la UI originale con fixture

Crea config, catalog, fixture sintetiche, preview entry e journeys in ui-review. L’adapter importa pagine, provider e stili originali. Sostituisci dati e dipendenze, non la UI; rifiuta richieste di rete sconosciute.

### 4. Verifica stati e interazioni

Copri normale, vuoto, caricamento, errore, accesso negato, dialoghi e recupero. Verifica ogni caso e i controlli reali in flussi continui. Riconcilia inventory, assertion legate al codice e route; supera --ui-complete sulla stessa radice. --complete rimane un audit rigoroso e separato di tutto il sorgente. Le sue attività aperte non sono il numero di schermate mancanti.

```sh
npx agent-canvas populate --config ui-review/canvas.config.mjs --source-root . --verify
```

### 5. Rivedi e mantieni dal codice

Avvia ui:review, esamina canvas e grafo e riproduci un flusso. Chiedi modifiche al vero codice dell’app. Le preview esistenti si ricostruiscono; nuovi stati e route richiedono inventory, fixture e journeys aggiornati. Pretendi la verifica completa prima della consegna.

```sh
npm run ui:review
```


### Cosa resta nell’applicazione

Il pacchetto condiviso mantiene viewer, CLI e skill. Il repository conserva adapter, fixture, inventory indipendente, catalog e test di interazione. Parti dall’esempio React/Vite eseguibile; altri stack richiedono adapter dedicati.

[Agent guide](https://github.com/tombelieber/app-canvas/blob/v0.16.1/AGENT_GUIDE.md) · [React/Vite](https://github.com/tombelieber/app-canvas/tree/v0.16.1/examples/react-vite)

### Skill opzionale

Codex e Claude Code possono installare la skill inclusa. Altri agenti leggono direttamente AGENT_GUIDE.md. Il runtime non chiama modelli né richiede chiavi API; il tuo agente ha costi e permessi propri.

```sh
npx agent-canvas install --target both
```

## Ambito e limiti

- Web usa HTML/CSS reali e JavaScript originale per interagire. UIKit, SwiftUI e Android richiedono harness e prove nel runtime originale; una cattura non è un’app nativa interattiva.
- La copertura collega codice revisionato e casi, senza scoprire automaticamente ogni condizione di business. I test UI non qualificano backend di produzione, accuratezza clinica o precisione dei modelli.
- Viewer: inglese predefinito, con 11 lingue. La demo pubblica è un frontend sintetico fisso; le integrazioni locali seguono il codice. Le prestazioni su iPad fisico non sono state misurate.

Dati sintetici · nessun backend app · nessun account · nessuna chiave API

[Articolo tecnico Safari](https://tomtang3.ai/blog/app-canvas-safari-rendering/)

API dettagliata, flusso nativo, alternative e manutenzione nel README inglese e nella guida dell’agente. [English README](README.md) · [MIT](LICENSE)
