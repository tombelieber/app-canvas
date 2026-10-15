---
name: app-canvas
description: Add or maintain a Figma-like overview of an application's real pages, named UI states and interactive flows using the shared App Canvas CLI.
---

# App Canvas

Create one navigable overview of real UI code. Keep the canvas engine in the shared `@tombelieber/app-canvas` package; each application owns only its catalog, synthetic fixtures, preview adapter and interaction checks.

## Integrate

1. Read the repository's commands and boundaries. Inspect actual routes, existing full-page stories, providers, styles and test fixtures. Reuse working Storybook previews when present; otherwise render the real app in an isolated preview entry using its existing build pipeline.
2. Use the installed `app-canvas` CLI. Installation: `npm install -g github:tombelieber/app-canvas#v0.1.1` followed by `app-canvas install --target both` and `app-canvas browsers`. Keep the package version consistent across projects. Canonical skill source: `tombelieber/tomstack`, `skills/engineering/app-canvas`; the tool includes an installer compatibility snapshot.
3. Add a project config exporting `title`, `groups`, `catalog`, `flows`, `watchPaths`, and `preview(ctx)`. The preview returns `url(screen)` and optional `build`, `handle`, `close` hooks. `readScenario` from `virtual:app-canvas-preview` retains the synthetic case through ordinary HTML navigation. `ctx.createVitePreview` reuses the application's Vite configuration. See the package's working example before inventing another renderer.
4. Inventory every actual page. Classify redirects and external destinations explicitly. Register meaningful states such as populated, empty, loading, error, denied, forms, dialogs and completion; include viewport and source module. Import production components and CSS. Fixtures provide inputs and dependencies, never a second implementation of the screen.
5. Keep the preview disposable and isolated. Inject synthetic identity, data and mutations at existing dependency boundaries. Reject unknown requests; never reuse production sessions, call live providers, publish content, change real permissions or open production databases to make a preview work. Do not weaken the real app's guards.
6. Add a `ui:review` command and run the CLI with `--verify`. Every registered screen must render. Check the important user interactions, failure recovery, reset/isolation, responsive widths, source-change refresh and absence of remote requests. Configure `routeCoverage` against the actual router and retain `pattern` on base cases; make omissions explicit and red-capable.

## Maintain

- Existing UI edits should update through the real source and watcher. A new state still needs an explicit case and, where relevant, a flow edge. Do not claim arbitrary code reveals every possible condition automatically.
- Keep screenshot caches and fixture persistence outside production assets and data. Mount bounded live previews; overview thumbnails are generated output.
- A web preview does not qualify native iOS/Android behavior. Add and verify a simulator/device adapter separately when requested.
- Report the working canvas URL, registered coverage, exercised interactions and exact limitations. Application release and public demonstration require their own authorization and qualification.
