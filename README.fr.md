<!-- Generated from launch/locales/fr.json; run npm run docs:generate. -->
# App Canvas

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [한국어](README.ko.md) · [Nederlands](README.nl.md)

## Toute votre UI. Un canevas. Le vrai code.

Explorez les écrans, états et parcours interactifs réels dans un canevas zoomable, créé et maintenu avec votre agent de programmation.

**[Ouvrir la démo](https://tombelieber.github.io/app-canvas/) · [Ajouter à votre dépôt](https://tombelieber.github.io/app-canvas/about/fr/start/) · [Article de lancement](https://tombelieber.github.io/app-canvas/about/fr/release/)**

## TL;DR

- Voyez ensemble les écrans complets, leurs états nommés et les parcours implémentés.
- Une seule implémentation UI. Votre agent crée fixtures, adapter et contrôles de couverture.
- Essayez 77 états et 44 parcours avec des données synthétiques, sans compte ni clé API.

![États réels de StoolSense sur le canevas App Canvas](docs/stoolsense-overview.jpg)

Démo réelle : 77 états, 44 parcours et 121 entrées lisibles. La file inclut des cas isolés, pas 121 parcours E2E.

## Voir, utiliser, rejouer

### Dézoomez pour comprendre l’application

Écrans complets regroupés par page, recherche, filtres et panneaux repliables. Un lien de parcours déplace la caméra vers sa destination.

### Zoomez pour utiliser la vraie UI

Browse verrouille les contrôles pendant le déplacement. Sélectionnez un écran puis Interact pour utiliser son code original avec des données jetables.

### Lancez Demo pour expliquer un parcours

Rejouez succès, échec et récupération dans une session continue : repères d’action, légendes, pause, vitesse et chronologie des étapes.

![Relecture réelle après un échec de sauvegarde hors ligne, avec brouillon conservé](docs/stoolsense-playback.jpg)

Vraie UI d’échec et de récupération. La lecture exécute des actions et vérifications ; tracer un lien ne constitue pas un test.

## Du dépôt existant au canevas interactif

Confiez l’intégration à un agent capable de lire, modifier et exécuter des commandes. Aucun Storybook ni inventaire manuel préalable requis. Installer le paquet ne peuple pas le canevas.

### À coller dans votre agent

```text
Read https://github.com/tombelieber/app-canvas/blob/v0.12.0/AGENT_GUIDE.md and add a completely populated App Canvas to this repository. Discover all screens, components, variants, states and navigation from the whole application source. Use original UI code. Create the missing synthetic fixtures and render harnesses. Reconcile an independent source inventory with rendered cases and source-linked runtime checks. Add checked happy, failure and recovery journeys. Run --complete against the original source root. Continue until the full landscape is populated and verified; report genuine blockers as incomplete. Keep production sessions, credentials and real user data out of previews.
```

### 1. Installer l’outil partagé

Utilisez Node.js 22+ et le gestionnaire et lockfile du projet. Installez la version GitHub épinglée, puis le navigateur. Avec npm 12, ajoutez --allow-git=root seulement si cette dépendance Git directe est bloquée ; ne changez pas la politique globale.

```sh
npm install --save-dev github:tombelieber/app-canvas#v0.12.0
npx app-canvas browsers
```

### 2. Inventorier avant de choisir les cas

Lancez discover sur toute la racine de l’application. L’agent examine chaque région et candidat, résout pending et énumère les états sémantiques indépendamment du catalog. Les blocages restent visibles.

```sh
npx app-canvas discover --source-root . --out .artifacts/app-canvas/inventory.json
npx app-canvas pending --inventory .artifacts/app-canvas/inventory.json
```

### 3. Afficher la vraie UI avec des fixtures

Créez config, catalog, fixtures synthétiques, preview entry et journeys dans ui-review. L’adapter importe pages, providers et styles d’origine. Remplacez données et dépendances, jamais l’UI ; refusez les requêtes inconnues.

### 4. Vérifier états et interactions

Couvrez normal, vide, chargement, erreur, accès refusé, dialogues et récupération. Vérifiez chaque cas et les vrais contrôles dans des parcours continus. Réconciliez inventory, assertions liées au code et routes ; passez --complete sur la même racine.

```sh
npx app-canvas --config ui-review/canvas.config.mjs --check
npx app-canvas --config ui-review/canvas.config.mjs --verify
npx app-canvas --config ui-review/canvas.config.mjs --complete --source-root .
```

### 5. Réviser et maintenir depuis le code

Lancez ui:review, examinez le canevas et rejouez un parcours. Faites modifier le vrai code. Les aperçus existants se reconstruisent ; nouveaux états et routes exigent inventory, fixtures et journeys actualisés. Exigez le contrôle complet avant livraison.

```sh
npm run ui:review
```


### Ce qui reste dans votre application

Le paquet partagé possède viewer, CLI et skill. Votre dépôt conserve adapter, fixtures, inventory indépendant, catalog et tests d’interaction. Partez de l’exemple React/Vite exécutable ; les autres stacks ont leur adapter.

[Agent guide](https://github.com/tombelieber/app-canvas/blob/v0.12.0/AGENT_GUIDE.md) · [React/Vite](https://github.com/tombelieber/app-canvas/tree/v0.12.0/examples/react-vite)

### Skill facultative

Codex et Claude Code peuvent installer la skill fournie. Tout autre agent peut lire AGENT_GUIDE.md. Le runtime n’appelle aucun modèle et ne demande aucune clé API ; votre agent garde ses propres coûts et permissions.

```sh
npx app-canvas install --target both
```

## Portée et limites

- Le Web utilise le vrai HTML/CSS et le JavaScript original pour les interactions. UIKit, SwiftUI et Android exigent des harnesses et preuves du runtime d’origine ; une capture n’est pas une app native interactive.
- La couverture relie du code examiné à des cas, sans découverte automatique de toutes les conditions métier. Les tests UI ne qualifient ni backends de production, ni précision clinique ou des modèles.
- Viewer : anglais par défaut, 11 langues. La démo publique est un frontend synthétique figé ; les intégrations locales suivent votre source. Les performances sur iPad physique ne sont pas mesurées.

Données synthétiques · sans backend d’app · sans compte · sans clé API

[Article technique Safari](https://tomtang3.ai/blog/app-canvas-safari-rendering/)

API détaillée, procédure native, alternatives et maintenance dans le README anglais et le guide de l’agent. [English README](README.md) · [MIT](LICENSE)
