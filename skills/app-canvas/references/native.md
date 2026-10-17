# Native UI landscape

Read this for UIKit/storyboards/XIB, SwiftUI, Android Views/XML/Compose, React
Native or other UI whose real renderer is a native runtime. The coding agent
owns native discovery, harness preparation and population just as it owns web
fixtures. Lack of existing previews is work to solve, not a prerequisite the
user must fulfill. Apply the complete-population contract alongside this file.

## Choose the smallest original-code rendering path

| Source | Discover | Render |
| --- | --- | --- |
| UIKit/storyboards/XIB | Scenes, controllers, segues, programmatic presentation, outlets, table/collection cells, alerts and size classes | Original controllers/views in a disposable simulator harness with their real resources and lifecycle |
| SwiftUI | Views, navigation, sheets, conditional branches, environment/state and preview declarations | Existing previews or agent-created previews/hosting harnesses using original views |
| Android Views/XML | Manifest, activities, fragments, navigation resources, layouts/qualifiers, adapters, dialogs and programmatic UI | Original screens in an emulator test/debug harness with synthetic dependencies |
| Compose | Destinations, composables, state holders, dialogs, branches and preview parameters | Existing or agent-created previews; emulator runtime for behavior the preview cannot reproduce |
| React Native | Navigation, native-backed components, platform files and state/provider boundaries | Actual simulator/device binary; a web adaptation is separately labeled |

Existing preview/gallery or screenshot engines can be reused when they fit the
actual codebase. Validate their installed APIs/version support. Do not migrate
UIKit to SwiftUI, Views to Compose, or a native app to React merely to populate
the canvas. A programmatic screen still gets an agent-created render entry.

## Run safely and reproducibly

Use task-owned simulator/emulator instances and disposable storage. Preserve
the original source; prefer a separate test target, debug entry, build variant
or copied harness workspace. Inject synthetic identity, API, content, clock,
permission results and storage at existing boundaries. Block unknown network
requests in the native process too; browser isolation does not cover native
HTTP clients, WebViews or media loaders. Never evict real devices, accept real
terms, record attendance or weaken production guards to reach a UI state.

Build original UI and resources using the repository's tools. Drive a known
scenario, wait for a distinguishing native/accessibility condition or an
explicit harness-ready signal, then capture. Control pending dependencies to
capture loading states. Check errors, keyboards, modal stacking, rotation,
tablet layouts and platform/resource variants present in the source. Use the
actual supported platform matrix or record an unresolved scope decision.
Do not assume phone screenshots cover tablet scenes or that a simulator proves
physical sensor behavior. Synthetic sensor input can render a chart; label it.

Record per capture: inventory/case ID, original source references, source and
harness revisions, content/fixture identity, build identifier, device/OS,
viewport/orientation/theme, starting condition, state assertion result and
capture SHA-256. Keep tokens, credentials and personal data out of artifacts.
If a build repair is required, record the patch and its impact; a modified
approximation cannot silently become evidence for untouched source.

## Put every state on the canvas

The shared canvas currently consumes browser preview adapters. A native
integration can supply an HTML evidence viewer containing full original native
captures, with one catalog case per state/platform/layout. Set the viewport
to the capture's logical dimensions; show original pixels without redrawing
the app in HTML. Reuse the shared canvas; keep the viewer and capture scripts
inside the target repository's `ui-review/`. In a non-JS repository the CLI can
be installed in that directory without inventing a root web application.

Large landscapes retain every catalog case while loading a bounded set of
passive source previews. Use page ownership, search and camera navigation to
inspect each state; the preview cache is not a coverage denominator.

Use `preview(ctx)` with `handle`/`url` or another verified loopback adapter.
Call ready only after the intended image is loaded. Serve only allowlisted
viewer assets and captures; never expose native source, databases, build
directories or whole workspace roots. Keep a readable incomplete inventory
while building; every missing state remains pending, never represented as a
successful original screen by a generic "unavailable" image.

Render evidence and interaction are different capabilities:

- Original native captures establish a visual surface for that recorded build
  and fixture. `--verify` checks the viewer plus its authored journeys; add
  project checks for native state assertions, provenance and image integrity.
- Native flow evidence comes from controls exercised in the simulator/device.
  Direct harness construction proves rendering, not reachability through real
  login or navigation. Label inferred, fixture and observed connections.
- A verified device-control/streaming adapter can add live interaction. It is
  optional for a landscape request. Viewer clicks must not be labeled as taps
  on the original app. Full application E2E is a separate requested scope.

## Refresh and finish

Provide one reproducible project command to rebuild/capture affected original
UI and refresh its canvas cases; retain full batch logs and per-case failures.
A watcher alone does not refresh native images. Track source and fixture/content
changes; recapture all affected states and keep stale ones visibly incomplete.
Bound native runtime concurrency and close task-owned processes after the batch.

Reconcile the entire independent inventory, including all implemented native
branches, against captures and native assertions. Native state/provenance
failures must fail the project's verification command. Connect that command
to the adapter's `verify` hook and return the source-linked native records
required by the [source walkthrough](source-audit.md). Final acceptance uses
`--complete`; image existence and viewer-only checks cannot satisfy it. Deliver
the working populated canvas and separate viewer/native results. Report actual
blockers without marking the full population complete, and continue all work
that does not depend on them.
