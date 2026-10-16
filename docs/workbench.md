# Pages, states and the touch workbench

Start in **頁面導航**: the whole-app view shows one card per page with its
features and state count. Select a page to see its features. Depth selects
page only, page plus features, or every named state. Search can find a state
across pages. **畫面總覽** exposes all states; **狀態圖** shows the branching
graph. Selecting a state expands its actual application UI.

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

On touch devices and narrow windows, the navigation opens as a drawer and
selected-screen information occupies a scrollable bottom panel. The remaining
canvas is the camera's fit area. Controls have at least 44px touch targets;
inputs use 16px text to avoid input-focus magnification. Portrait, landscape,
split view and safe-area insets are handled without page-level overflow.
The native preview keeps its own scrolling while in Interact.

## Bounded actual-code previews

The renderer has a budget of **four live app iframes on touch devices** and
**eight on desktop**, including the continuing playback frame. During playback, only that continuing
frame and already-retained drafts run; duplicate background cases stay unloaded. Zoomed-out
summaries and unloaded frames show labels/conditions, never screenshots.
Selecting or sufficiently zooming into a frame loads its real adapter.
Catalog size is not the number of concurrently running apps.

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
portrait/landscape/split widths, panel recovery, scoped/depth navigation,
cross-page camera movement, bounded frames and absence of host reloads or
external requests. CI runs both before GitHub Pages deployment.

These are desktop-engine/device-emulation checks. A physical iPad's Safari,
memory pressure, virtual keyboard and long-session behavior still require
device validation. Static metadata from the previous runtime remains supported
during a cached upgrade. The reported iPad crash has not been reproduced on physical
hardware; resource bounds and stable iframe ordering address observed
implementation risks without establishing a device-specific crash cause.
