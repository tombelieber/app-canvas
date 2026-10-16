# Add App Canvas to an existing repository

**For coding agents:** deliver a working overview of this repository's real UI,
not a proposal, screenshots alone or a second implementation of its design.
Follow the user's repository instructions and authorization boundaries.

[Try the public StoolSense canvas](https://tombelieber.github.io/app-canvas/) ·
[Tool source](https://github.com/tombelieber/app-canvas) ·
[Runnable React/Vite reference](examples/react-vite)

## The outcome

The developer opens one zoomable canvas, sees the app's pages and named states,
follows labeled flow connections that pan/zoom to the destination, and uses a
screen's actual controls directly on the canvas. All cases render live DOM;
screenshots are not the overview renderer.
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
npm install --save-dev github:tombelieber/app-canvas#v0.6.0
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
paths, page/state source locations and labeled `flows` edges. Every catalog
case must be addressable and render actual code when opened. Declare `pages`
from the actual router and `pageId` / `feature` on each state; see the
[page/feature/state and tablet contract](docs/workbench.md). The overview and
state graph show full source-rendered HTML/CSS, with no summary cards or raster
screenshots. Render-only DOM documents keep the whole app visible; selection
and playback use the original app code. DOM-compatible content uses four touch
/ eight desktop running-app slots. Unsupported drawing/embedded content and
legacy manifests retain live rendering; measure that fallback separately. Interacted previews stay mounted across filters and modes. Never
reorder their DOM ancestors or silently evict drafts; retained capacity requires
an explicit release. Browse locks app controls; Interact is an explicit button.
Top/left/right panels must remain recoverable after hiding them. Filtering must preserve drafts;
reset must restore only the selected fixture. The shared bridge namespaces
both Storage APIs before app code. Supply frame-local substitutes for
IndexedDB, SDK caches and other persistence too. Do not treat the trusted-code
iframe as a hostile-code security sandbox.

Measured DOM stays local. For a separately authorized public static export,
review the rendered fixtures/assets before setting `exportDom: true` on the
publishable preview adapter. Do not copy measured local DOM when the static
adapter sanitizes or replaces that data.

The Vite helper and custom HTML served through `handle` receive the bridge
automatically. Separate-origin custom preview servers must inject
`ctx.bridgeHtml(html)` before their application scripts. Every preview signals
`data-review-ready="true"` only after its named state has settled.

Add named `journeys` for all reviewed happy, failure and recovery paths using the
[authoring contract](docs/journeys.md). Playback executes real controls and
assertions in one persistent preview session; its camera follows confirmed
states. A flow link navigates between independently seeded cases. Keep those
two meanings clear. The renderer never infers arbitrary flows automatically.
Add a `kind: "case"` journey for every catalog entry, with a DOM assertion for
that exact state and an explicit `condition` for independently seeded variants.
Read-only, loading and authentication states are valid cases; do not invent
a successful recovery or live sign-in to make them appear interactive.
Use `outcome: "neutral" | "success" | "failure" | "pending" | "warning"`
on states. Use `kind: "condition"` or `"reference"` on edges that describe
fixture variants or component references rather than actual app operations.
Checked journey transitions are added to the graph automatically. Full-page
overview and compact state graph use the same real-code preview adapter.
Test touch navigation and WebKit with `npm run test:touch` and `npm run test:tablet`
in the tool repository. Emulation does not qualify a physical iPad.

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
Enable `coverage: { requireAllCases: true, requireConnected: true }`. Prove it
fails when a new case lacks its checked journey or graph connection. Do not
silence the guard by creating a generic "body exists" assertion. Check the
visible condition, completion, disabled control, retained draft or meaningful
output that distinguishes that case. See the [77-case example](examples/stoolsense/journeys.mjs).

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
requests, checks live canvas controls, executes every authored journey and runs
the config's interaction checks.
Also verify source edit → changed mounted UI, appropriate
viewport widths, reset and isolation, and no real network/provider mutations.
Click a next-flow link across group/search filters and a graph edge: selection,
camera position and zoom must all reach the destination. Test controls inside
the canvas and scrolling to long-form actions. Measure simultaneous-frame cost
on the target app; the 77-case demo does not prove unbounded scalability.
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
