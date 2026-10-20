# Add App Canvas to an existing repository

**For coding agents:** deliver the complete UI landscape of this repository.
Own discovery, fixtures, render setup, population and verification; the user
does not supply a screen list or repeatedly ask you to continue. A few working
screens are an intermediate result. Follow the required
[completion contract](skills/app-canvas/references/completion.md).
Follow the user's repository instructions and authorization boundaries.

[Try the public StoolSense canvas](https://tombelieber.github.io/app-canvas/) ·
[Tool source](https://github.com/tombelieber/app-canvas) ·
[Runnable React/Vite reference](examples/react-vite)

## URL input

For a website URL and editable captured landscape, follow the separate
[desktop URL import guide](docs/url-import.md) and the canonical
[URL skill reference](skills/app-canvas/references/url-import.md). Available in v0.13.0; verify the installed CLI exposes `import`, `capture-script`,
`capture`, `status`, `link` and `open`. App Canvas + the agent support an existing
authorized browser or a dedicated capture browser. Resolve the accessible
worklist, review fidelity, edit, Save and verify a fresh offline reopen. Keep
app-specific captures and trials private. Imports report observed scope and
cannot pass the source completeness gates below.

## The outcome

The developer opens one zoomable canvas, sees the app's pages and named states,
follows labeled flow connections that pan/zoom to the destination, and uses a
screen's actual controls directly on the canvas for web adapters. Web cases
render original DOM. Native apps can use full original-runtime captures with
source/build provenance, or a verified device adapter; follow the
[native integration contract](skills/app-canvas/references/native.md).
Capture viewers expose visual evidence; their controls do not become native
app controls. React and pre-existing previews are not prerequisites.
They ask their coding agent to edit the corresponding source. Existing screen
previews regenerate from that source; new pages and conditions get catalog
entries and coverage checks. No Figma document is required.

The coding agent performs the end-to-end integration. The CLI supplies the
canvas and verification primitives. Each repository owns its independent
source inventory, catalog, fixtures/harnesses, adapter and checks. Installation
of the CLI or skill alone does not populate an application; when asked to add
the canvas to an application, perform that population in the same task.

## 1. Inspect and establish coverage

- Read the repository's agent instructions, app entry point, router, providers,
  build configuration, existing stories/previews and test/fixture conventions.
  For native, include manifests, storyboards, layouts, controllers, navigation
  and programmatic UI. Follow resource/metadata/import references across UI roots.
- Inventory all routed pages, redirects, shared UI and meaningful conditions:
  populated/empty, loading, errors and recovery, permissions, dialogs, forms,
  saved/unsaved data and responsive variants where they change the interface.
- Use existing real page stories if they already render the application well.
  Otherwise import the real app/router or its real page/provider composition.
  Preserve its stylesheet, theme, assets and layout. Never re-create pages as
  fixture JSX/HTML or maintain a fork of the canvas engine inside the app.
- Build `ui-review/inventory.json` from source independently of the catalog.
  Enumerate screens, components, states, variants and navigation with source
  references, conditions and platform/layout applicability. Cross-check against
  runtime navigation and resources/tests; route counts are not state counts.
  Map each discovered item to rendered cases. Resolve every pending item; do
  not reduce the denominator to the easiest screens. Record scope, counts,
  evidence-based non-UI classifications and actual blockers in `ui-review/README.md`.
  For the separate strict source audit, fresh Objective-C data-only method
  annotations permit specific explanations
  after bounded helper/callback analysis; they never remove source IDs or waive
  the owning file, caller UI or unknown effects.

## 2. Install the tool and optional skill

Requires Node.js 22+. Use the repository's package manager and lockfile; npm
examples below are the reference path. The runtime makes no model calls; the
user's coding agent performs discovery and integration.

```sh
npm install --save-dev github:tombelieber/app-canvas#v0.13.0
npx app-canvas browsers
```

On npm 12, Git admission may require `--allow-git=root` on that install command.
Keep the exception scoped to the direct requested dependency and command.

The installed package includes this guide and `app-canvas guide`. New UI
delivery commands require v0.13.0 or later;
v0.12.0 does not contain them. The release pin and lockfile record the qualified revision. For another tool revision,
verify its availability and inventory export before pinning it; do not invent
an unavailable tag or drop the source gate to use an older build.

The guide works with any agent that can read files, edit code and run commands.
Codex and Claude Code can additionally install the bundled Agent Skills format:

```sh
npx app-canvas install --target both
```

Targets are `codex`, `claude`, or `both`. The installer preserves unmanaged or
locally edited skills. Other agents can read this guide and `skills/app-canvas/SKILL.md`
directly or use their own supported skill loader; they do not need a Claude
plugin. Do not claim untested clients or frameworks are certified.

This repository owns the canonical skill, its references, CLI and releases.
Use this source for skill updates; no separate skill repository is required.
For Claude's standalone marketplace or migration from an older installation,
follow the [installation instructions](README.md#connect-a-project).

## 3. Integrate the actual app

Keep project-specific files under `ui-review/` (or the nearest existing test
fixture directory):

```text
ui-review/
  canvas.config.mjs    # groups, cases, flows, source paths, watch paths, checks
  catalog.json         # explicit, stable screen/state IDs
  frame.jsx            # real UI entry with preview-only dependencies
  fixtures.js          # disposable synthetic transport/provider state
  ui-inventory.json    # independent UI worklist, states, grouping and mappings
  prepare.mjs          # inspected adapter preparation, not guessed screen markup
  routes.json          # reviewed route inventory, when supported
  README.md            # coverage, commands, fixture boundaries and omissions
```

For native applications, implement the [native capture/harness path](skills/app-canvas/references/native.md)
and adapt this file layout. Keep native rendering checks separate from viewer
checks and connect them to `verify`. A native repository can keep the CLI's
package/lockfile under `ui-review/` without adding a root web app. Missing
isolation, previews or synthetic data are the agent's work to complete.

For web applications, read the complete [React/Vite reference](examples/react-vite) for a runnable
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
case must be addressable and show its actual UI when opened. Declare `pages`
from the actual router/native navigation and `pageId` / `feature` on each state; see the
[page/feature/state and tablet contract](docs/workbench.md). The overview and
state graph show full real UI with no summary cards. Web uses source-rendered
HTML/CSS; native captures follow the native provenance contract. Compatible
web DOM shares one viewport-sized opaque sandbox with isolated shadow trees
and source-viewport CSS. Count all browsing contexts and verify that zooming
reuses DOM instead of rebuilding every context. Native top-layer previews keep
their original isolated renderer. Render-only
DOM documents keep web UI visible; selection
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

Complete **UI delivery** uses the [population workflow](skills/app-canvas/references/population.md).
Use `app-canvas guide` from the installed package. Run `plan` on the whole
original repository before captures, inspect all files and UI anchors, and
reconcile meaningful states with actual navigation. Keep one project/device
owner, deduplicate exact equivalent captures and resume durable checkpoints.

```js
coverage: { requireAllCases: true, requireConnected: true },
uiCoverage: { inventory: 'ui-review/ui-inventory.json' },
// population: adapter tasks with fingerprints, artifacts and device resources
// verifyUi: original-runtime state and action/recovery transition evidence
```

Run `populate` for preparation plus fresh `--ui-complete` acceptance. Missing
states, unresolved UI anchors, uninspected files, wrong grouping, stale sources
or missing runtime evidence fail. A state omitted from both catalog and semantic
inventory must still fail independent discovery. Inspect code/navigation beyond
syntax anchors; they cannot infer every semantic condition in arbitrary code.
Prioritize supported phones and add only distinct implemented tablet layouts.
Group by page → feature → state, with layout/platform variants underneath.
New UI deliveries above 128 cases start at feature depth, or page depth when
features also exceed 128. All states/search/flow links retain the whole model.

The existing `--complete` remains the unchanged, stricter
[all-source audit](skills/app-canvas/references/source-audit.md). It still
requires version 2 discovery and every raw obligation's review/evidence.
Report audit-only pending work separately from missing UI; UI acceptance never
turns an audit failure into a pass. Finish both if both are requested. Legacy
source inventories and registered-case checks remain construction evidence.

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
npx app-canvas populate --config ui-review/canvas.config.mjs --source-root .
# --verify verifies then exits; otherwise keep the verified viewer open.
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

Report the working URL, discovered/rendered/pending counts by kind/platform,
actual checks, source/build/content revisions, source refresh/recapture proof
and refresh commands. Follow the repo's commit/push policy. Completion requires
the full reconciled inventory, all required cases rendered and checked, and no
unresolved required items. A limitation report or passing viewer test does not
convert partial population into completion. Continue all independent work while
a genuine external blocker is pending.

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
Native Swift/Kotlin/Java and React Native UI use agent-authored simulator/device
harnesses and adapters. This package supplies the shared viewer/coverage
mechanisms and native workflow contract; it does not ship a universal native
renderer or automatically discover semantic states without the coding agent.

## Viewer language and usage privacy

The viewer defaults to English with an in-place switcher for all eleven launch
languages. Application content and authored case labels keep their own language.
Official CLI downloads enable minimal anonymous tool usage events; users can
run `app-canvas telemetry off` or set `APP_CANVAS_TELEMETRY=0`. CI, DNT/GPC and
self-hosted exports can disable transmission. No application data, source or
paths are sent. See [telemetry](docs/telemetry.md). Do not send fixture or
repository content to analytics when extending an adapter.
