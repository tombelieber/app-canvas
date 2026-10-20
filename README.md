# App Canvas

<!-- launch:begin -->
[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [한국어](README.ko.md) · [Nederlands](README.nl.md)

**[Product & multilingual guides](https://tombelieber.github.io/app-canvas/about/) · [Agent walkthrough](https://tombelieber.github.io/app-canvas/about/start/) · [Release story](https://tombelieber.github.io/app-canvas/about/release/)**

CLI **v0.13.1** · Demo **77 states · 44 flows · 121 playable entries**, including standalone cases. Viewer: English by default + 10 languages.
<!-- launch:end -->

A zoomable overview of your real application pages, named states and flows. Selected screens render live HTML/CSS/JS. Press Interact to use them in place; follow a flow to pan and zoom to its destination.

**[Play with the hosted StoolSense canvas →](https://tombelieber.github.io/app-canvas/)**
No install, login or API key. Explore **77 named states**, labeled flows and
working recording/editing/import/export interactions using synthetic data.
Play **44 interaction flows and all 77 individual cases**, separately or as
one queue. The branching state graph labels success, failure, waiting and
conditional variants using complete real UI screens.

![A failed save, retained draft and successful retry on the real UI canvas](docs/stoolsense-playback.jpg)

One runtime serves multiple projects. Each project keeps its **screen catalog, preview adapter, synthetic fixtures and interaction checks**. Components, layouts and CSS come from the application. There is no second design file to synchronize.

## Import a website (desktop v1)

**App Canvas + an agent** can turn a URL into an editable desktop landscape,
record observed screens/states/flows, and save/reopen local design edits. Use an
existing authorized browser through the packaged DOM reader, or the dedicated
capture browser. No Figma account or model API key is required by the package.
See the [desktop URL import guide](docs/url-import.md) for commands, sign-in,
privacy, editing and fidelity limits. Available in v0.13.1 with the matching CLI and skill. Source-backed and native workflows keep their existing
complete-population contracts.

## Give this to your coding agent

Open your application repository in your agent and paste:

```text
Read https://github.com/tombelieber/app-canvas/blob/main/AGENT_GUIDE.md
and add a completely populated App Canvas to this repository. Discover all
screens, components, variants, states and navigation from source. Create the
missing fixtures and web/native render harnesses yourself. Use original UI
code. Reconcile an independent source inventory against rendered cases and
enable the complete-population gates. Continue until the whole UI landscape
is populated and verified; report genuine blockers as incomplete.
```

The [agent guide](AGENT_GUIDE.md) contains installation, integration, coverage,
verification and ongoing maintenance steps. The bundled [React/Vite example](examples/react-vite)
is a runnable reference. It does not require Figma or a particular AI vendor.
An agent that can inspect/edit code and run commands can follow the guide;
Codex and Claude Code also have a bundled skill installer.

The coding agent owns discovery and population; existing stories, previews or
component isolation are not required inputs from the user. Web adapters render
original HTML/CSS/JS. Native UIKit, SwiftUI and Android apps use agent-authored
harnesses to render/capture original UI and populate the same canvas. See the
[native workflow](skills/app-canvas/references/native.md). The package does not
bundle a universal device renderer; viewer checks and native checks are separate.

## Try the included application

Requires Node.js 22+ and Chromium installed through Playwright. Viewer controls default to English, with a persistent switcher for all 11 launch languages. App screen titles and contents remain in their original language.

```sh
npm install -g github:tombelieber/app-canvas#v0.13.1
app-canvas browsers
app-canvas demo
```

On npm 12, if Git admission blocks the install, add `--allow-git=root` to that
`npm install` command. This admits only the requested direct Git dependency;
do not change global npm policy.

Open <http://127.0.0.1:6106>. The bundled StoolSense example contains **77 authored cases** from a real recording app, with synthetic records. Recording, correction, deletion, import, export, navigation and dialogs work locally. It makes no AI calls and needs no account.

The example is a frozen frontend export. In a live project the adapter imports current application code; the source watcher rebuilds the overview. Changing this frozen example does not modify the original application.

Browse by dragging/zooming. Select a screen and press **Interact** or **▶ 操作 App** to
use its controls directly on the canvas. **下一步**, **上一步** and graph edges
select the destination and move the camera there. Esc returns to browsing.
Filtering keeps drafts; **重設** restores only that named preview.
Press **▶ Demo** in the toolbar for a hands-free presentation. It plays the
selected journey or queue; with no selection it plays every authored flow and
standalone case, or the flows related to the page you are browsing.
The audience sees the continuing app, visible action cues, step captions and
progress while the camera follows confirmed screens. Choose all demos, a page
or one flow in the player. Its video-style controls include elapsed time,
approximate remaining time, a step timeline, 0.5×–4× speed, next step and
previous/next Demo. Pause, replay or exit with **Esc**; exiting restores your
browsing scope and panels. Timeline positioning rebuilds the target flow's
required state; skipped demos are labeled separately from completed ones.
Projects with only standalone cases present those conditions with clear labels;
projects without journeys need authored interactions before Demo is available.
Use **播放流程** to run a checked journey, pause, single-step or replay with
fresh fixtures. Flow links navigate between named cases; playback performs
actions in one continuing app session. See [journey authoring](docs/journeys.md).
Choose **全部 Demo** to play the entire reviewed set. Each flow keeps its
own continuing session; the next flow or standalone case starts fresh. A
standalone case starts from its declared fixture condition and checks that
view, including states that require an external login or provider outcome.
It is not presented as a user navigating to every state from one session.
**畫面總覽** shows every complete UI; **狀態圖** connects the same full screens.
A single compact toolbar and collapsible sidebars preserve iPad landscape space.
**顯示其他分支** retains neighboring states while following a selected flow.

The hosted demo also uses this frozen synthetic export. It has no application
backend, production session, real health records or AI requests. Minimal optional tool usage events are separate; see [telemetry controls](docs/telemetry.md).
Saving and deleting affect only the disposable browser preview. GitHub Pages
serves the static files under GitHub's own hosting policies.

## Connect a project

Install the agent skill once, then invoke `$app-canvas` in the target repository:

```sh
app-canvas install --target both
```

Targets: `codex`, `claude`, or `both` (default). The installer copies the canonical
[skill](skills/app-canvas/SKILL.md), metadata and references into
`~/.codex/skills/app-canvas` and `~/.claude/skills/app-canvas`. Existing unmanaged
or edited skills are preserved.

This repository owns the canvas, CLI, canonical skill and releases together.
No other skill collection or marketplace is required.

### Standalone Claude plugin

Claude Code users can install the same skill through App Canvas's own marketplace:

```sh
claude plugin marketplace add tombelieber/app-canvas
claude plugin install app-canvas@app-canvas
```

The plugin supplies the skill; install the CLI with npm as shown above. Choose
either the Claude plugin or `app-canvas install --target claude` to avoid duplicate
Claude skills. The Codex CLI installer works independently of the Claude plugin.

### Existing Tomstack installations

The complete skill now lives here. Tomstack no longer bundles another copy.
Install the standalone skill before updating the Tomstack bundle:

- For the Tomstack Claude bundle, use the standalone Claude plugin commands above.
- For a skill installed with `skills`, change its source with
  `npx skills@latest add tombelieber/app-canvas --skill app-canvas` and select the
  same target agents.
- CLI-managed copies upgrade with `app-canvas install --target both` after the
  CLI update. For a manually copied or locally linked skill, preserve the old
  directory or link before installing; the CLI deliberately refuses to overwrite it.

The existing `app-canvas@tomstack` marketplace listing remains a compatibility
entry pointing directly to this repository. New installations can use
`app-canvas@app-canvas` without Tomstack. See [release maintenance](docs/releasing.md).

For manual integration, start with `canvas.config.mjs`:

```js
export default {
  title: "My app",
  port: 6107,
  groups: [{ id: "pages", title: "Pages" }],
  catalog: [
    {
      id: "home",
      group: "pages",
      title: "Home",
      path: "/",
      source: "src/pages/Home.tsx",
      viewport: { width: 390, height: 844 },
    },
  ],
  flows: [], // { from: 'home', to: 'detail', label: 'Open item' }
  journeys: [], // Optional checked sequences; see docs/journeys.md.
  watchPaths: ["src", "ui-review"],
  preview: (ctx) =>
    ctx.createVitePreview({
      appRoot: ".",
      entry: "/ui-review/frame.tsx",
      // Add preview-only SDK aliases and synthetic environment values here.
    }),
};
```

The Vite adapter uses the host project's Vite, aliases, plugins and CSS pipeline. Its preview entry imports the actual app or actual page/provider composition. Inject data at existing dependency boundaries. Do not copy the UI into fixtures. The [StoolSense adapter](examples/stoolsense/canvas.config.mjs) also demonstrates a custom non-Vite renderer.

```js
// In a Vite preview entry, BEFORE importing application modules:
import {
  installPreview,
  ready,
  failed,
  readScenario,
} from "virtual:app-canvas-preview";

const scenario = readScenario(catalog, { key: "my-app" });
installPreview({ handleFetch: syntheticTransport });
// Render the real UI with synthetic identity and API/SDK dependencies.
// Call ready() after the selected case settles; call failed(error) on failure.
```

The transport returns a `Response` for known requests. Unknown fetch requests are rejected and make verification fail. Mock SDK clients separately if your app uses them. The Vite preview sets a local-only resource policy and does not read application `.env` files. Run previews with synthetic data and providers. A custom renderer owns its own transport and resource isolation.

```sh
app-canvas --config canvas.config.mjs
app-canvas --config canvas.config.mjs --check
app-canvas --config canvas.config.mjs --verify
```

`--check` validates the catalog, journeys and configured route coverage. `--verify` renders every registered case, rejects preview errors/unmocked requests, tests the live canvas and every authored journey, then runs your optional `verify({ browser, preview, manifest, canvasOrigin })` interaction function. `--port` overrides an occupied canvas port; the tool never stops another service.

Set `coverage: { requireAllCases: true, requireConnected: true }` once every
catalog state has a checked `kind: "case"` journey and belongs to the state
graph. Adding a state without its case or connection then fails `--check`.
Existing integrations can adopt this incrementally; the UI shows missing
case coverage. The demo enforces both checks.

## Keep coverage honest

Complete **UI delivery** uses the independent [population workflow](skills/app-canvas/references/population.md):

```sh
app-canvas guide
app-canvas plan --source-root <application> --out ui-review/ui-inventory.json
app-canvas status --inventory ui-review/ui-inventory.json
app-canvas populate --config ui-review/canvas.config.mjs --source-root <application>
# Or run the final gate directly: --ui-complete --source-root <application>
```

These UI-delivery commands are available in v0.13.1;
v0.12.0 does not include them. Pin a qualified commit and read its matching guide.
The coding agent owns source/navigation discovery, all meaningful screens and
states, original UI adapters, page/feature grouping and connected checked flows.
`populate` resumes its authored tasks, reuses intact unchanged artifacts, leases
devices and always performs a fresh final UI gate. New UI deliveries above 128
cases open grouped by page/feature (page depth if features also exceed 128);
“All states”, search and links still reach every case. Existing starting views
remain compatible. An unresolved source UI anchor,
missing state, stale source or missing original-runtime assertion fails. Syntax
anchors assist inspection; they do not infer arbitrary app semantics by themselves.

The existing `--complete` remains the unchanged stricter
[all-source audit](skills/app-canvas/references/source-audit.md), with version 2
`discover` / `pending` worklists and obligation-linked evidence. Internal audit
checks are separate from missing screens. A UI pass does not make a failed
source audit pass. Legacy `sourceCoverage` / `requireSourceInventory` checks
remain supported. `--check` / `--verify` alone qualify registered cases only.

UI and CSS edits refresh from source. **The agent owns discovering and
registering new states.** Reconcile source discovery with real navigation and
the catalog; never reduce the denominator to easy cases. See the
[completion contract](skills/app-canvas/references/completion.md).

For React Router JSX/object routes, add an inventory guard:

```js
routeCoverage: [{
  file: 'src/app/router.tsx',
  snapshot: 'ui-review/routes.json',
  // Optional imported path constants:
  maps: [{ file: 'src/routes.ts', name: 'APP_ROUTE' }],
}],
```

Create the reviewed snapshot with `inventoryRoutes` from `@tombelieber/app-canvas/routes`; store the original route pattern on each base case as `pattern`. A new/changed route, unresolved path expression or page omitted from the catalog fails the check. Redirects are counted separately. This inventory supports the route forms in the repository tests, not every router/framework.

`preview(ctx)` can return `url(screen)`, `build()`, `handle(req,res,url)`, and `close()`. URLs must use loopback HTTP(S). Configs and preview code are trusted local code. The Vite helper and HTML served through `handle` get the shared preview bridge automatically. A custom server on a separate origin must apply `ctx.bridgeHtml(html)` before its application scripts.

The default **畫面總覽** shows complete real HTML/CSS for all named states.
The measurement pass reuses source-rendered DOM and styles in render-only
preview documents; it does not generate screenshots or a second UI. Compatible
screens share one viewport-sized sandbox with isolated DOM trees, avoiding an
iframe per state. The demo has four passive contexts for all 77 screens;
native dialogs retain their own renderer. Zooming reuses the shared DOM.
Selecting a screen loads its original app code; Interact unlocks real controls.
The branching **狀態圖** also displays full screens. Page/feature/depth filters
and playback live in collapsible sidebars, with one 52px toolbar on iPad landscape.
DOM-compatible content uses four touch / eight desktop running-app slots,
including playback. Unsupported drawing/embedded content retains live rendering
and needs project-specific resource checks. Edited frames stay mounted across
filters and modes; explicitly release a retained frame at capacity.
See the [workbench and iPad guide](docs/workbench.md).

DOM measurements and compiled files live under
`node_modules/.cache/app-canvas/`. Source changes reload the previews;
dependency/configuration changes may require restarting the command.
The bundled demo covers 77 cases and 121 playable entries. WebKit iPad emulation
is tested; physical iPad memory pressure and long-session stability need device
validation. Cost still depends on the app.
Overview heights are measured once per source build, avoiding resize feedback
in `vh`/scroll-area layouts. Interactive frames use the configured native
viewport and normal app scrolling, including keyboard focus.

The bridge namespaces `localStorage` and `sessionStorage` per frame and keeps
preview values in disposable tab storage. It preserves them across ordinary
HTML navigation and clears the selected frame on reset. Adapters still own
SDK caches, IndexedDB, service workers and other persistence; supply disposable
implementations. This is fixture isolation for trusted app code, not a security
sandbox for running unknown code.

## Publish a synthetic canvas

The local development server stays loopback-only. A project can separately
provide `preview.exportStatic({ outDir })`: it writes explicitly publishable
frontend assets and returns `{ [caseId]: './frame/index.html?id=case-id' }`.
The shared exporter adds the same live canvas UI, preview bridge and relative manifests:

```sh
app-canvas export --config canvas.config.mjs --out <new-directory>
```

The output works at a domain root or nested path. Export requires every case
to render, refuses an existing output directory and fails without an explicit
static adapter. It does not sanitize arbitrary repositories or turn a live
backend into a static application. Review publication rights, source content,
fixtures, images and the exported artifact before hosting it.

The included StoolSense adapter is already synthetic and exportable. Its
[static asset mapping](examples/stoolsense/static.mjs) is intentionally
specific to that frozen frontend. This repo's GitHub Pages workflow builds and
tests that example on main; it never reads the private StoolSense repository.

## Safari performance measurements

The [physical iPhone Safari benchmark](docs/safari-benchmark-2026-10-18.md)
includes native FPS, sampled process memory and per-trial results. The tested
optimization bundle was not adopted: its footprint increased. The hosted demo
retains the already deployed runtime; no state-of-the-art performance claim is made.

## Related OSS

This is an existing problem with useful existing solutions, not an empty market:

| Project                                                                           | Best fit                                                                                                                                                                                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Story Flow](https://storybook.js.org/addons/@zigbang/storybook-addon-story-flow) | Very close alternative: Storybook stories on an interactive flow canvas, variants, coverage and agent authoring support. Consider this first if your app already has suitable full-page stories. |
| [html-flow-board](https://github.com/snowpact/html-flow-board)                    | Interactive HTML flow boards and FlowML authoring.                                                                                                                                               |
| [Playroom](https://github.com/seek-oss/playroom)                                  | Composing real components across viewports.                                                                                                                                                      |
| [React Cosmos](https://github.com/react-cosmos/react-cosmos)                      | Component fixtures and isolated development.                                                                                                                                                     |
| **App Canvas**                                                                    | Standalone CLI and project adapters, including non-React renderers, with bounded actual-code previews, camera-following flows and checked journey playback.                                            |

The core canvas uses [React Flow](https://github.com/xyflow/xyflow). App previews
do not require adopting React Flow or Storybook. Native Swift/Kotlin/React Native
UI needs an agent-authored capture/device adapter and native verification
following the bundled workflow; a universal native renderer is not implemented here.

## Develop

```sh
npm ci
npm run check
npm test
npm run test:navigation
npm run test:journeys
npm run test:queue
npm run test:file
npm run test:all-cases
npm run test:browser
npm run test:onboarding
npm run build:demo
npm run test:static
npm run check:privacy
npm run pack:check
```

MIT. See [third-party notices](THIRD_PARTY_NOTICES.md) and [example provenance](examples/stoolsense/provenance.json).
