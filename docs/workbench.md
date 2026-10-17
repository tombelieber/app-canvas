# Pages, states and the touch workbench

The DOM rendering and interaction details below describe web preview adapters.
For original native UI captures and device adapters, follow the
[native workflow](../skills/app-canvas/references/native.md); full captures are
valid visual surfaces and viewer interaction is separate from native controls.

Start in **畫面總覽** with every named state shown as complete application
UI. **狀態圖** connects the same full screens as a directed graph. Neither
view replaces screens with summary cards. The left sidebar filters pages,
features and depth; these controls change which full screens are shown.
Selecting a screen zooms to it. Search finds states across pages.

## Page ownership

Declare pages from the real router, separately from fixture inputs and flows.
`pageId` is diagram ownership; existing fixture fields such as `page` stay
untouched:

```js
pages: [
  { id: 'home', title: 'Home', route: '/' },
  { id: 'settings', title: 'Settings', route: '/settings' },
],
catalog: [
  { id: 'home-empty', title: 'Empty list', group: 'app',
    pageId: 'home', feature: 'Records', source: 'src/Home.tsx' },
  { id: 'settings-denied', title: 'Settings denied', group: 'app',
    pageId: 'settings', feature: 'Access', source: 'src/Settings.tsx' },
],
```

`route` is a human-readable label, not a preview URL. Keep route patterns and
concrete fixture paths in the existing route-coverage/adapter fields. Shared
components and global errors may have explicit shared scopes without an
invented route. Page IDs must be unique and every state must own a declared
page. Legacy configurations without `pages` use their groups as page scopes.
The agent authors features from the application; no runtime AI or extra API
is required. Graph cycles and transition hops do not define hierarchy depth.

The sidebar groups states by page and feature. The journey picker lists flows
touching the current page; once a flow is selected its picker remains stable
through cross-page playback. Whole-app queues are labeled separately. Related
connections are shown by default; the sidebar can reveal all edges or hide
them. The inspector always exposes the selected state's incoming/outgoing
links, including cross-page destinations. Following one reveals its scope,
selects it and pans/zooms the camera to the destination.

## Browse, interact and panels

- **Browse** is the default: drag to pan, pinch to zoom, tap to select. App
  controls cannot receive pointer input. Drag distance is distinguished from
  a tap. Desktop wheel/keyboard controls remain available.
- **Interact** explicitly unlocks one actual app frame. Tap Browse to return;
  Escape is an optional desktop shortcut. No double-click or hover is needed.
- **面板** toggles the top toolbar, left navigation and right inspector. Local
  preferences are scoped by project title and URL path. The mode/panel dock
  remains visible, even with all panels hidden; **還原版面** restores defaults.

iPad landscape uses docked left/right sidebars, a full-height canvas and one
**52px toolbar**. Both sidebars are shown by default and can be collapsed
independently; collapsing a sidebar returns its width to the canvas.
Page/search/depth controls belong to the left sidebar; playback and selected
screen details belong to the right. Each sidebar has a collapse button; the
top toolbar also has direct panel toggles. The floating dock restores panels
when the toolbar is hidden. At widths below 1000px, navigation becomes a drawer
and details use a bottom panel. Pointer type does not force landscape tablets
into the narrow layout. Controls have 44px touch targets and inputs use 16px
text. The remaining canvas is the camera's fit area.

**▶ Demo** remains in the dock even when the top toolbar is collapsed. It
starts an audience presentation of the selected journey/queue, defaulting to
all authored demos, or related journeys when browsing a page. The player
offers all/page/flow scope selection. Editing chrome and other screens are temporarily
hidden without changing saved panel preferences. The continuing app keeps
the native viewport, the camera follows confirmed states, and the footer
shows action captions, a step timeline, elapsed/approximate remaining time,
0.5×–4× speed, next step, previous/next Demo and pause/replay/exit controls.
Positioning replays prerequisites from fresh fixtures; skipped demos stay
separate from completed ones. Exit
or Esc cancels playback and returns to the previous browsing scope. See
[Demo playback](journeys.md#one-click-audience-demo) for pacing and errors.

## Full UI without starting every app

During the existing isolated measurement pass, App Canvas captures the HTML
and CSS that the **real source app** produced. It preserves form values,
CSSOM styles, SVG and local image/font assets. Compatible overview documents
share **one viewport-sized, opaque-origin iframe**, with a shadow tree per
source screen. Source media queries, `rem` and viewport lengths are resolved
in the measured source viewport, independent of the viewer's phone width.
These are complete HTML/CSS trees, without raster screenshots or separately
written UI. Only the fixed shared renderer runs here; app scripts never run.
Open native dialogs/popovers keep separate inert documents and use one
fixed, hash-authorized bootstrap to restore the browser's own top layer and
backdrop. Preview documents are inert and have an opaque origin; application
scripts and event handlers are stripped, and cannot access the parent app.
Both the full overview and graph show actual page contents at every zoom.
The passive overview defers backdrop filters while the camera moves and in
previews narrower than 120 canvas CSS pixels. Larger idle previews restore
source effects after 150 ms; text and form layout do not change. Selection
and playback keep the original application's effects. See
[Safari rendering measurements](rendering-performance.md) for the experiments,
quality tradeoff and device-qualification limits.
Offscreen shared trees stop painting during viewport changes and are reused
on return. They do not recreate browsing contexts or refetch source DOM on each
zoom. The shared iframe's physical surface stays the size of the canvas, even
at 500% zoom. Separate native/legacy passive iframes are released during an
active pinch. When zoomed out, all visible screens remain visible. The bundled
77-case demo uses **one shared iframe for 74 states plus three native dialog
iframes**, rather than 77 separate browsing contexts. This is a measured demo
count, not a bound for arbitrary unsupported apps. Source rebuilds refresh
both the overview documents and live apps. A failed shared document shows a
load error; selection can still open the original app.

Selecting a screen loads the original HTML/CSS/JS. Interact unlocks its real
controls; playback uses one continuing original app. DOM-compatible previews
keep at most **four running app frames on touch devices / eight on desktop**,
including the player. Passive overview documents are not running app instances.
During playback only the continuing app and retained drafts run.

Large catalogs also defer card contents outside the preview and retained-app
sets. Every source ID, graph position and connection handle stays addressable;
only nearby cards and retained running apps mount their full contents. Page
playlist selection scans the catalog once, rather than once per journey.

Canvas/video/embedded/shadow-root content, imported or inaccessible styles,
and assets that cannot be safely embedded fall back to the original live app.
Those visible fallback frames are additional to the regular live budget; large
projects using those surfaces need their own resource measurements. This
fallback preserves existing integrations and avoids showing an incorrect UI.
Old manifests without DOM documents continue to use real app frames.

Measured documents stay local by default. Static publication copies them only
when the explicitly publishable adapter also sets `exportDom: true`, after its
fixtures and assets have been reviewed. An adapter that sanitizes/replaces its
local data must not opt in with unreviewed local DOM. The frozen synthetic demo
uses this opt-in; it exports the same public frontend that was measured.

Entering Interact retains that frame in memory across scope, view and panel
changes. Keep iframe ancestor DOM order stable: moving an existing iframe
ancestor can reload the browsing context despite a stable React key. Unopened
previews may be evicted. Up to three touch or seven desktop frames can be
retained, reserving one slot for selection/playback. At that capacity another
Interact is blocked with a release control in **面板**. Releasing asks before
discarding that preview's changes; it never silently evicts an edited frame.
Reset is also explicit and affects only its chosen fixture. Reload/source
rebuild starts a new preview run; preview drafts are not durable app records.

## Verification boundary

`npm run test:touch` exercises actual touch input in Chromium, including pan,
pinch, accidental-tap prevention, capacity and draft retention.
`npm run test:tablet` checks the workbench with WebKit touch emulation and runs
the complete synthetic StoolSense queue of 44 flows plus 77 cases. It includes
1280×760 landscape (toolbar ≤52px, docked sidebars, full screens),
portrait/split widths, panel recovery, scoped/depth navigation,
cross-page camera movement, bounded running app frames and absence of host reloads or
external requests. CI runs both before GitHub Pages deployment.

On Linux, run tablet QA in a rendered virtual display:

```sh
xvfb-run -a env APP_CANVAS_HEADED=1 npm run test:tablet
```

CI uses this same WebKit display mode. The headless Linux engine can stop the
main document's animation frames with the full iframe canvas; the test checks
that the rendering clock advances before exercising actual touch input. The
display mode retains the same viewport, touch actions, case assertions and
complete queue. macOS can use the default headless mode.
Linux GTK mobile emulation also needs a planned reload after a test changes
device dimensions. These are counted separately; unexpected app reloads still
fail. The macOS/Chromium runs retain in-place resize checks.

`npm run test:zoom` adds 20 repeated zoom cycles on the 77-screen demo, including
the maximum 500% canvas zoom. It checks the total browsing-context count,
viewport-sized shared surface, single DOM load per case and native offscreen
documents while each gesture is active. It returns to the full overview and
rejects host reloads or page errors. This uses DOM touch events through the actual canvas listener;
it is not a physical-device gesture or a device memory qualification. The
tablet gate includes this regression check.

These are desktop-engine/device-emulation checks. A physical iPad's Safari,
memory pressure, virtual keyboard and long-session behavior still require
device validation. Static metadata from the previous runtime remains supported
during a cached upgrade. Static entry points version the actual JS/CSS and
metadata requests so a new page does not silently reuse the previous runtime.
The reported physical Safari crash remains a separate device check; a desktop
engine or Simulator passing does not establish the phone's termination cause.
