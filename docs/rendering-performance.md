# Safari rendering: measurements and limits

App Canvas keeps every registered screen as source-rendered UI. Selection and
playback run the original application. The overview uses the same captured
HTML/CSS, with a deliberate rendering-quality policy: backdrop filters are
deferred during camera movement and in previews narrower than 120 canvas CSS
pixels. Larger idle previews restore the source effect after 150 ms. Text,
form layout, images and registered states stay present; live applications keep
their original effects.

## Changes

- Subscribe to React Flow's actual viewport store with `useViewport`. A touch
  regression exposed a changed graph transform while preview visibility still
  used a previous callback snapshot. Rendering and eviction now use the same
  camera as the graph, including internal transforms.
- Keep the shared iframe outside the transformed graph. Its final rectangle
  remains viewport-sized without an inverse scale that can create expensive
  intermediate compositing surfaces. Start the graph at its intended overview
  scale rather than briefly displaying it at 100%. The overview paints above
  group backgrounds; its pixels cannot tint the original running screen or
  the current journey, whose passive preview is hidden.
- Keep source layout under CSS transforms. Direct CSS `zoom` reduced some
  graphics allocations but changed text wrapping and native form sizes; it is
  not a faithful substitute. Reducing only thumbnail/motion backdrop effects
  avoids that reflow.

## Experiments

The public synthetic StoolSense fixture has 77 states: 74 compatible source
DOM documents and three isolated native-dialog documents. All comparisons
reuse those source documents. Native Safari measurements use physical
WebContent footprint, including graphics charged to that process; GPU-process
figures are not added again. A small JavaScript heap or RSS is insufficient.

Exploratory results below are desktop Safari, DPR 2. They are observations,
not universal memory budgets. Workloads differ as noted, so this table does
not claim a percentage improvement in peak memory.

| Experiment | Observed result | Decision |
| --- | --- | --- |
| Original renderer | About 2.2 GiB settled; a zoom-control trial sampled about 4.9 GiB | Excessive graphics allocation |
| Fixed viewport plane alone | About 1.3 GiB settled; zoom spikes remained | Useful partial change |
| CSS zoom inside source DOM | About 0.4 GiB settled in some trials, but changed wrapping and controls | Rejected for layout differences |
| CSS zoom on the iframe, fixed or quantized | Some low settled readings; later startup/zoom trials exceeded a 2 GiB stop budget | Rejected as an unreliable fix |
| Fixed plane with adaptive backdrop effects | Final landscape build: 1,912 MiB sampled peak; 635 MiB after return, including loading and 20 maximum-zoom cycles | Selected; physical iOS qualification remains open |

The final native run used Safari 27.0.1, DPR 2, a 1728 × 954 CSS-pixel window
and a 1228 × 902 canvas. It recorded 215 footprint samples over 75 seconds,
starting before page navigation, through loading and 20 zoom-in/out rounds.
Telemetry confirmed an actual 1.5%–500% zoom range, 1,600 zoom-handler calls,
all 77 cases on return, and one source load per shared document. Its final
WebContent footprint was 634.58 MiB, including 538.92 MiB of graphics charged
to that process. This was page navigation in an existing Safari process,
not a fresh-process or empty-browser-cache trial.

An earlier candidate, before the source-color layering correction, sampled
1,620 MiB at 946 × 946. The original renderer's approximately 4.9 GiB result
also used 946 × 946, but a different zoom cadence. These are separate trials,
not a matched estimate of a percentage reduction. The final landscape result
is below the experiment's 2048 MiB stop threshold; that threshold is not a
universal Safari limit or proof of adequate headroom on another device.

This was native Safari running the real zoom-button handlers, not native
multi-touch input or a physical iOS memory measurement. Sampling may miss
shorter peaks. Physical iPhone/iPad qualification remains outstanding; these
experiments do not establish a release as crash-free.

## Verification

`tests/overview-quality.browser.mjs` checks original text wrapping and native
control geometry from 1.5% to 500%, thumbnail effects, idle restoration and
cancellation of an old restoration timer. The previous renderer fails its
camera-effect assertion. Direct CSS zoom also fails source-layout comparisons.

The full fixture comparison checks 5,522 text/form elements across the 74
shared documents at five zoom levels in Chromium and WebKit. The selected
transform-based renderer introduced no changed line counts; maximum observed
onscreen geometry difference was approximately 0.03 CSS pixels at 500%.

The shared-preview gate checks every source surface against its selectable
canvas frame at phone and landscape sizes. A pixel comparison verifies group
backgrounds cannot tint opaque source UI; playback hides the passive copy so
the original running application stays visible. The zoom gate exercises 20 touch
event cycles and 480 intermediate samples, checking offscreen eviction,
viewport-sized surfaces, unchanged source-document loads and context lifetime.
These synthetic touch events are separate from physical-device gestures.

Run the relevant checks with:

```sh
npm run check
npm test
node tests/overview-quality.browser.mjs
npm run test:shared
npm run test:zoom
npm run test:navigation
npm run test:live
npm run build:demo
npm run test:static
```

The application-specific StoolSense gate additionally checks its current
source, authored flows, save/edit/delete, imports, exports and isolated
transport. These checks qualify the UI development tool, not health data,
medical classification or the application's production backend.

## Research

- [WebKit Layers Tab](https://webkit.org/web-inspector/layers-tab/) explains
  the memory tradeoff of compositing layers and how to inspect their cost.
- [Filter Effects Level 2, working draft](https://drafts.fxtf.org/filter-effects-2/)
  describes backdrop images and filtering. Selector isolation alone does not
  establish a graphics-memory budget; explicit backdrop-root experiments did
  not sufficiently reduce this fixture's footprint.
- [Figma's WebGPU renderer](https://www.figma.com/blog/figma-rendering-powered-by-webgpu/)
  uses a custom C++/Wasm engine, batched GPU work and resource reuse. Merely
  switching APIs is not a DOM rendering optimization.
- [Figma incremental frame loading](https://www.figma.com/blog/incremental-frame-loading/)
  addressed mobile prototype memory failures by loading needed frames. That
  is useful for interaction runtimes, but does not remove the cost of a
  requirement to display every visible overview screen.

Native Safari, Playwright WebKit and a physical iPhone/iPad are separate
qualification surfaces. This report does not claim that all physical iOS
crashes are fixed, or that an arbitrary larger application fits this budget.
Raw native traces, device identifiers and private profiling automation are
excluded from the public repository.
