# Add App Canvas to an existing repository

**For coding agents:** deliver a working overview of this repository's real UI,
not a proposal, screenshots alone or a second implementation of its design.
Follow the user's repository instructions and authorization boundaries.

[Try the public StoolSense canvas](https://tombelieber.github.io/app-canvas/) ·
[Tool source](https://github.com/tombelieber/app-canvas) ·
[Runnable React/Vite reference](examples/react-vite)

## The outcome

The developer opens one zoomable canvas, sees the app's pages and named states,
follows labeled flow connections, and opens a screen to use its actual controls.
They ask their coding agent to edit the corresponding source. Existing screen
previews regenerate from that source; new pages and conditions get catalog
entries and coverage checks. No Figma document is required.

This is an agent-assisted integration, not a universal one-command state
discovery algorithm. Keep one shared canvas engine. Each repository owns its
catalog, fixtures, preview adapter and interaction checks.

## 1. Inspect and establish coverage

- Read the repository's agent instructions, app entry point, router, providers,
  build configuration, existing Storybook/stories and test/fixture conventions.
- Inventory all routed pages, redirects, shared UI and meaningful conditions:
  populated/empty, loading, errors and recovery, permissions, dialogs, forms,
  saved/unsaved data and responsive variants where they change the interface.
- Use existing real page stories if they already render the application well.
  Otherwise import the real app/router or its real page/provider composition.
  Preserve its stylesheet, theme, assets and layout. Never re-create pages as
  fixture JSX/HTML or maintain a fork of the canvas engine inside the app.
- Record the coverage denominator in `ui-review/README.md`: pages and named
  states included, important flows, known omissions and unsupported boundaries.
  Do not call an uncounted subset "the whole app".

## 2. Install the tool and optional skill

Requires Node.js 22+. Use the repository's package manager and lockfile; npm
examples below are the reference path. No paid API key or model call is needed.

```sh
npm install --save-dev github:tombelieber/app-canvas#v0.2.0
npx app-canvas browsers
```

The guide works with any agent that can read files, edit code and run commands.
Codex and Claude Code can additionally install the bundled Agent Skills format:

```sh
npx app-canvas install --target both
```

Targets are `codex`, `claude`, or `both`. The installer preserves unmanaged or
locally edited skills. Other agents can read this guide and `skills/app-canvas/SKILL.md`
directly or use their own supported skill loader; they do not need a Claude
plugin. Do not claim untested clients or frameworks are certified.

## 3. Integrate the actual app

Keep project-specific files under `ui-review/` (or the nearest existing test
fixture directory):

```text
ui-review/
  canvas.config.mjs    # groups, cases, flows, source paths, watch paths, checks
  catalog.json         # explicit, stable screen/state IDs
  frame.jsx            # real UI entry with preview-only dependencies
  fixtures.js          # disposable synthetic transport/provider state
  routes.json          # reviewed route inventory, when supported
  README.md            # coverage, commands, fixture boundaries and omissions
```

Read the complete [React/Vite reference](examples/react-vite) for a runnable
configuration, the correct import order, fixture isolation and real interaction
tests. Adapt its integration to the target app; do not copy its Tasks UI.

`preview(ctx)` returns `url(case)` and optionally `build()`,
`handle(req,res,url)` and `close()`. The URL must be loopback HTTP(S).
`ctx.createVitePreview(...)` uses the host's Vite, aliases, plugins and CSS.
`virtual:app-canvas-preview` supplies `installPreview`, `readScenario`, `waitFor`,
`ready` and `failed`. Install synthetic dependencies before importing modules
that perform I/O. Call `ready()` only when the selected state is visible.

Use the app's existing data boundaries: synthetic fetch responses, SDK clients,
identity providers and frame-local storage. Unknown requests must fail. Never
reuse a user's browser session, read production records, enable a live provider,
weaken real authorization or publish a user's data to make a preview work.
Keep external assets local and licensed. Confirm critical interactions really
change fixture state and reset cleanly.

Add `ui:review` and `test:ui:review` package scripts. Register source/config watch
paths, page/state source locations and labeled `flows` edges. The overview uses
generated thumbnails and opens only one live app iframe at a time.

## 4. Make missing coverage fail

For supported React Router JSX/object route forms, configure `routeCoverage`
with source and reviewed snapshot paths. Generate the snapshot with
`inventoryRoutes` from `@tombelieber/app-canvas/routes`. Base cases retain their
route `pattern`, including parameters, separately from a concrete fixture `path`.
A new route or a missing base case must make `--check` fail. Inspect changes
before updating a snapshot; do not blindly refresh it to silence the gate.

For another router, use its actual route manifest and add a project-specific
coverage check; do not pretend the React Router parser covers it. Named business
states still need authored cases and interaction tests even with route checks.

Implement `verify({ browser, preview, manifest, canvasOrigin })` in the config.
Exercise the app's important flows through real controls, including mutation,
failure recovery and reset/isolation. A flow line is a navigation aid, not proof
that its corresponding application interaction works.

## 5. Verify and hand over

```sh
npx app-canvas --config ui-review/canvas.config.mjs --check
npx app-canvas --config ui-review/canvas.config.mjs --verify
npm run ui:review
```

`--verify` renders every registered case, rejects preview errors and unknown
requests, checks the canvas controls and runs the config's interaction checks.
Also verify source edit → regenerated thumbnail → changed live UI, appropriate
viewport widths, reset and isolation, and no real network/provider mutations.
Deliberately remove a base page once to show the coverage guard can fail, then
restore it. Connect the gate to the repository's existing relevant checks.

Report the working URL, page/redirect/state counts, interactions exercised,
source refresh proof and exact omissions. Follow the repo's commit/push policy.
The integration is done only when the developer can open and use it.

## Ongoing edits and sharing

When asked to change a screen, edit its actual application source. Keep its case,
fixtures and tests aligned with behavior changes. Add a case for every new page
or meaningful condition; the watcher cannot infer arbitrary business states.

The hosted StoolSense demo is a frozen synthetic frontend export. Live project
canvases read their own current source. To publish a different project's canvas,
first obtain publication authority and create an explicit `exportStatic` adapter
that writes only reviewed synthetic preview assets. Then use
`app-canvas export --config ui-review/canvas.config.mjs --out <new-directory>`.
The exporter refuses existing output directories and adapters without a static
export contract. It does not sanitize private code or data automatically.

Supported today: a shared browser canvas, a Vite adapter and custom loopback
preview adapters (the bundled vanilla-JS StoolSense example uses one). A working
adapter for another web framework must be implemented and verified in that repo.
Native Swift/Kotlin/Java/device UI and React Native device rendering need their
own simulator/device adapter; this package does not currently flatten them.
