# Third-party software and prior art

App Canvas uses React Flow (`@xyflow/react`, MIT), React and React DOM (MIT),
esbuild (MIT), Playwright (Apache-2.0), TypeScript (Apache-2.0), and Dagre /
Graphlib (MIT) for directed graph layout, and proper-lockfile (MIT) for
population ownership and device resource leases. CSS Tree (MIT) parses normalized
CSS; its data dependencies include mdn-data (CC0-1.0) and source-map-js
(BSD-3-Clause). Their
packages retain their respective copyright and license notices.

The runnable StoolSense example is an author-owned frontend with synthetic
fixtures. Its preview bundle includes fflate, Papa Parse, and read-excel-file
(MIT); their license texts are included under the example's notices directory.

Similar projects exist. In particular, `@zigbang/storybook-addon-story-flow`
(MIT, npm 0.5.0 inspected on 2026-10-16) embeds real stories and transitions in
React Flow and includes an authoring skill. Its advertised GitHub source URL
returned 404 during this inspection. `snowpact/html-flow-board` (MIT) offers
HTML storyboards, pan/zoom, arrows and diagram text. `seek-oss/playroom` (MIT)
and React Cosmos provide related real-component preview workflows.

This project is an extraction of a working application review tool, not a
claim to have invented code-backed UI canvases. No competitor source code is
included. The initial focus is standalone application adapters, isolated
interactive live-code previews, checked journey playback and a shared CLI.
