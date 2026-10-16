---
name: app-canvas
description: Add or maintain a Figma-like overview of an application's real pages, named UI states and interactive flows using the shared App Canvas CLI.
---

# App Canvas

Create one navigable overview of real UI code. Keep the canvas engine in the shared `@tombelieber/app-canvas` package; each application owns only its catalog, synthetic fixtures, preview adapter and interaction checks.

For first-time integration, read the public [agent guide](https://github.com/tombelieber/app-canvas/blob/main/AGENT_GUIDE.md) and its complete [React/Vite reference](https://github.com/tombelieber/app-canvas/tree/main/examples/react-vite). The [hosted synthetic StoolSense canvas](https://tombelieber.github.io/app-canvas/) demonstrates the expected overview and interactions. An agent can follow the guide without a vendor-specific skill loader.

## Integrate

1. Read the repository's commands and boundaries. Inspect actual routes, existing full-page stories, providers, styles and test fixtures. Reuse working Storybook previews when present; otherwise render the real app in an isolated preview entry using its existing build pipeline.
2. Use the shared CLI. For reproducible repository commands, add `github:tombelieber/app-canvas#v0.3.0` as a dev dependency with the project's package manager, then run `npx app-canvas browsers`. Optional user skill setup: `npx app-canvas install --target both`. A global CLI installation is also supported. Canonical skill source: `tombelieber/tomstack`, `skills/engineering/app-canvas`; the tool includes an installer compatibility snapshot.
3. Add a project config exporting `title`, `groups`, `catalog`, `flows`, optional checked `journeys`, `watchPaths`, and `preview(ctx)`. The preview returns `url(screen)` and optional `build`, `handle`, `close` hooks. `readScenario` from `virtual:app-canvas-preview` retains the synthetic case through ordinary HTML navigation. `ctx.createVitePreview` reuses the application's Vite configuration. Vite and custom HTML served through `handle` receive the shared frame bridge automatically; separate-origin custom servers apply `ctx.bridgeHtml(html)` before app scripts. See the working example before inventing another renderer.
4. Inventory every actual page. Classify redirects and external destinations explicitly. Register meaningful states such as populated, empty, loading, error, denied, forms, dialogs and completion; include viewport and source module. Import production components and CSS. Fixtures provide inputs and dependencies, never a second implementation of the screen.
5. Keep the preview disposable and isolated. Inject synthetic identity, data and mutations at existing dependency boundaries. Reject unknown requests; never reuse production sessions, call live providers, publish content, change real permissions or open production databases to make a preview work. Do not weaken the real app's guards.
6. Add a `ui:review` command and run the CLI with `--verify`. Every registered screen renders live DOM on the canvas. Check the important user interactions, failure recovery, reset/isolation, responsive widths, source-change refresh and absence of remote requests. Flow links and graph edges must select, pan and zoom to their destination, including across filters. Configure `routeCoverage` against the actual router and retain `pattern` on base cases; make omissions explicit and red-capable.
7. Record page/redirect/state counts and omissions in `ui-review/README.md`. Prove the coverage guard fails when a page is removed. Verify real controls perform mutations and recover from errors; a drawn flow edge is not interaction proof. Hand over a working URL, not only setup instructions.

## Maintain

- Existing UI edits should update through the real source and watcher. A new state still needs an explicit case and, where relevant, a flow edge. Do not claim arbitrary code reveals every possible condition automatically.
- Render real HTML/CSS/JS in every named frame. Browse mode pans/zooms; interaction stays inside the canvas. Filtering preserves mounted drafts and reset restores only the selected case. The bridge namespaces both Storage APIs in disposable tab storage; adapters must also isolate IndexedDB, SDK caches and other persistence. These are trusted-code previews, not hostile-code sandboxes.
- Author happy/failure/recovery journeys using the tool's [journey contract](https://github.com/tombelieber/app-canvas/blob/main/docs/journeys.md). Playback performs real controls and assertions in one continuing session and follows confirmed states; flow links navigate independently seeded cases. `--verify` executes authored journeys. Retain real pointer/keyboard E2E checks too.
- Measure simultaneous-frame performance for the target project. The demo qualifies 77 live cases; it does not prove unbounded catalogs or arbitrary heavy apps. Source changes reload previews; new states still need registration.
- A web preview does not qualify native iOS/Android behavior. Add and verify a simulator/device adapter separately when requested.
- Public hosting requires an explicitly publishable synthetic adapter, publication authority and artifact review. `app-canvas export --config <config> --out <new-directory>` shares the same canvas runtime; `preview.exportStatic` supplies the reviewed frontend. It does not automatically remove private data or make any backend static.
- Report the working canvas URL, registered coverage, exercised interactions and exact limitations. Application release and public demonstration require their own authorization and qualification.
