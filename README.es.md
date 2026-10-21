<!-- Generated from launch/locales/es.json; run npm run docs:generate. -->
# App Canvas

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [한국어](README.ko.md) · [Nederlands](README.nl.md)

## Toda tu UI. Un lienzo. Código real.

Explora pantallas, estados y flujos interactivos reales en un lienzo ampliable, creado y mantenido con tu agente de programación.

**[Abrir demo](https://tombelieber.github.io/app-canvas/) · [Añadir a tu repo](https://tombelieber.github.io/app-canvas/about/es/start/) · [Historia del lanzamiento](https://tombelieber.github.io/app-canvas/about/es/release/)**

## TL;DR

- Ve juntas las pantallas completas, sus estados y los flujos implementados.
- Mantén una sola implementación de UI. Tu agente crea fixtures, adapter y verificaciones de cobertura.
- Prueba 77 estados y 44 flujos con datos sintéticos, sin cuenta ni API key.

![Estados reales de StoolSense en el lienzo App Canvas](docs/stoolsense-overview.jpg)

Demo real: 77 estados, 44 flujos y 121 entradas reproducibles. Incluye casos independientes; no son 121 recorridos E2E.

## Explora, interactúa y reproduce

### Aléjate para entender la app

Pantallas completas agrupadas por página, búsqueda, filtros y paneles plegables. Los enlaces de flujo llevan la cámara al destino.

### Acércate para usar la UI real

Browse bloquea los controles para mover el lienzo. Selecciona una pantalla y pulsa Interact para usar el código original con datos desechables.

### Pulsa Demo para explicar un recorrido

Reproduce éxito, fallo y recuperación en una sesión continua, con indicaciones, subtítulos, pausa, velocidad y línea temporal.

![Reproducción real tras un fallo de guardado sin conexión, conservando el borrador](docs/stoolsense-playback.jpg)

UI real de fallo y recuperación. La reproducción ejecuta acciones y comprobaciones; una conexión dibujada no es una prueba.

## De un repo existente a un lienzo interactivo

Encarga la integración a un agente que pueda leer, editar y ejecutar comandos. No necesitas Storybook ni una lista previa de pantallas. Instalar el paquete no llena el lienzo por sí solo.

### Pega esto en tu agente

```text
Read https://github.com/tombelieber/app-canvas/blob/v0.15.0/AGENT_GUIDE.md and add a completely populated App Canvas to this repository. Discover all screens, components, variants, states and navigation from the whole application source. Use original UI code. Create the missing synthetic fixtures and render harnesses. Reconcile an independent source inventory with rendered cases and source-linked runtime checks. Add checked happy, failure and recovery journeys. Group by actual page and feature, connect checked flows, deduplicate repeated captures and resume checkpoints. Run --ui-complete against the original source root; keep the stricter --complete source audit separate and unchanged. Continue until the full landscape is populated and verified; report genuine blockers as incomplete. Keep production sessions, credentials and real user data out of previews.
```

### 1. Instala la herramienta compartida

Usa Node.js 22+ y el gestor y lockfile del proyecto. Instala la versión fijada desde GitHub y el navegador. En npm 12, añade --allow-git=root solo si bloquea esa dependencia Git directa; no cambies la política global. Hasta publicar v0.13.0, utiliza un commit de desarrollo verificado para estos comandos UI.

```sh
npm install --save-dev github:tombelieber/app-canvas#v0.15.0
npx app-canvas browsers
```

### 2. Inventaría antes de elegir casos

Ejecuta plan en todo el repositorio original. Revisa cada archivo, anclaje UI, dependencia que afecte a la UI y navegación real. Enumera pantallas y estados independientemente del catálogo; mantén visibles las UI pendientes.

```sh
npx app-canvas plan --source-root . --out ui-review/ui-inventory.json
npx app-canvas status --inventory ui-review/ui-inventory.json
```

### 3. Renderiza la UI original con fixtures

Crea config, catalog, fixtures sintéticos, preview entry y journeys en ui-review. El adapter importa páginas, providers y estilos reales. Sustituye datos y dependencias, no la UI; rechaza solicitudes desconocidas.

### 4. Verifica estados e interacciones

Incluye estados normal, vacío, carga, error, acceso denegado, diálogos y recuperación. Comprueba cada caso y los controles reales en flujos continuos. Concilia inventory, assertions vinculadas al código y rutas; pasa --ui-complete sobre la misma raíz. --complete sigue siendo una auditoría estricta e independiente de todo el código fuente. Sus pendientes no equivalen a pantallas ausentes.

```sh
npx app-canvas populate --config ui-review/canvas.config.mjs --source-root . --verify
```

### 5. Revisa y mantén desde el código

Ejecuta ui:review, explora el mapa y reproduce un flujo. Pide cambios al código real. Las vistas existentes se reconstruyen; rutas y estados nuevos requieren actualizar inventory, fixtures y journeys. Exige el control completo antes de entregar.

```sh
npm run ui:review
```


### Qué conserva tu aplicación

El paquete compartido mantiene viewer, CLI y skill. Tu repo mantiene adapter, fixtures, inventory independiente, catalog y comprobaciones. Empieza con el ejemplo ejecutable React/Vite; otros stacks necesitan su adapter.

[Agent guide](https://github.com/tombelieber/app-canvas/blob/v0.15.0/AGENT_GUIDE.md) · [React/Vite](https://github.com/tombelieber/app-canvas/tree/v0.15.0/examples/react-vite)

### Skill opcional

Codex y Claude Code pueden instalar la skill incluida. Otros agentes siguen AGENT_GUIDE.md directamente. El runtime no llama a modelos ni necesita API key; tu agente tiene sus propios costes y permisos.

```sh
npx app-canvas install --target both
```

## Alcance y límites

- Web utiliza HTML/CSS reales y JavaScript original al interactuar. UIKit, SwiftUI y Android necesitan harnesses y evidencia del runtime original; una captura no es una app nativa interactiva.
- La cobertura relaciona código revisado y casos, no descubre automáticamente toda condición posible. Las pruebas UI no validan backends de producción ni precisión clínica o de modelos.
- Viewer: inglés por defecto y 11 idiomas. La demo pública es un frontend sintético fijo; las integraciones locales siguen tu código. No se ha medido el rendimiento en un iPad físico.

Datos sintéticos · sin backend de app · sin cuenta · sin API key

[Artículo técnico de Safari](https://tomtang3.ai/blog/app-canvas-safari-rendering/)

API detallada, flujo nativo, alternativas y mantenimiento en el README inglés y la guía del agente. [English README](README.md) · [MIT](LICENSE)
