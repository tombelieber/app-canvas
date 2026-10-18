# Native overview experiment

Measured on 2026-10-19 against main
`c6dd98bf82e46d8031f80e562ecd233261eef3fa`. The candidate is the runtime in
the same commit as this report. This compares the integrated Canvas viewer,
original adapter, original case selection and continuing player, rather than
a standalone drawing prototype.

## Inputs and method

A frozen private native-app catalog contained **1,756 distinct UI cases** and
20,681 retained evidence records. Records are not additional screen nodes.
The population digest was
`6b828e2ba7e2d36c6424143a28666c054d265f9c8c8d4f077f9861aea602c97d`.
Both versions received identical catalog, page groups, original PNGs and case
journeys. Original capture SHA-256 digests and viewport/image aspect ratios
were checked before preparation. Private captures and app-specific helpers
are deliberately not published here.

Hardware: Apple M5 Max, 128 GiB RAM, macOS 27.0.1. Playwright 1.64.1 used
Chromium 156.0.8078.4 (headed, ANGLE Metal M5 Max) and WebKit 27.2
(headless, Apple GPU). Viewport was 1512 × 982, DPR 1. Each engine ran three
fresh-process trials per version, alternating base/candidate order. Browser
tests did not run concurrently with measurements. Local servers were already
built; readiness includes loading the viewer, its ready signals, whole-app
fit and a 150 ms settle. It excludes server build and atlas preparation.

Each trial performed 60 real mouse drag movements and 36 wheel events, followed
by original capture selection, SHA verification, a grouped content selection,
navigation away/back to check retained content, and an original native Demo.
RAF intervals measure main-thread scheduling during that input sequence;
they are not input-to-display latency or a guarantee of display FPS.

The app prepared a 2048 × 3520 atlas: 506,836 compressed bytes, 27.5 MiB
decoded RGBA. Preparation took 8.712 seconds, including separate 96/384-pixel
derived previews. That one-time cost is excluded from viewer timings.

## Results

Values below are medians of the three trials; lower time/memory is better.

| Measurement | Main | Candidate |
| --- | ---: | ---: |
| Chromium drag/wheel p95 RAF interval | 108.4 ms | 25.5 ms |
| WebKit drag/wheel p95 RAF interval | 155 ms | 34 ms |
| Chromium viewer readiness | 1,828 ms | 1,501 ms |
| WebKit viewer readiness | 2,012 ms | 1,532 ms |
| Chromium JS heap at overview | 151.8 MiB | 66.8 MiB |
| Chromium summed browser-process RSS | 2,036.1 MiB | 1,700.2 MiB |
| Case bounds intersecting whole-app viewport | 1,092 / 1,756 | 1,756 / 1,756 |
| Passive native app iframes at overview | 8 | 0 |
| Heavy card bodies at overview | 128 | 0 |

The candidate drew all 1,756 native atlas images. Graph IDs and hit targets
remain present; zero heavy card bodies does not mean zero indexed nodes.
Main's intersecting bounds count measures geometry, not loaded image coverage.

All per-trial p95 intervals, including the slower candidate trial:

| Engine / repetition | Main | Candidate |
| --- | ---: | ---: |
| Chromium 1 | 108.4 ms | 25.5 ms |
| Chromium 2 | 108.2 ms | 58.3 ms |
| Chromium 3 | 108.4 ms | 25.1 ms |
| WebKit 1 | 163 ms | 34 ms |
| WebKit 2 | 152 ms | 35 ms |
| WebKit 3 | 155 ms | 34 ms |

Chromium long-task counts were 96/96/96 on main and 0/42/0 on the candidate.
The outlier remains in the results. This is an improvement, not a zero-jank
claim. WebKit long-task telemetry and comparable heap/RSS were unavailable.
RSS sums can double-count shared pages and do not measure unique physical
memory or GPU residency. These are snapshots, not a memory-plateau proof.

## Image and behavior verification

Independent screenshot checks used actual node geometry and reference atlas
pixels, rather than trusting `data-drawn`. At whole-app fit, 1,751/1,756 cases
in each engine were unambiguously closer to their source than blank Canvas.
Five very small/low-contrast captures were ambiguous under minification.
Those same five passed the unchanged source-versus-blank comparison in both
engines at 91–100 CSS pixels wide, below the 120-pixel original-runtime
threshold, with **zero original iframes**. Thus every case had actual GPU pixel
evidence, without treating ambiguous whole-app samples as passes. The minimap
was hidden only for pixel audits; ordinary chrome remained during interaction.
This checks visible capture presence, not legibility at tiny scale or every
business-state assertion within the app.

All 12 integrated trials passed original capture SHA, content chooser,
retained content and actual native Demo checks, without page errors. Separate
Chromium/WebKit browser tests passed actual React input/save, GPU tile clicks,
clickable cross-page edges, filters, continuing multi-step React playback,
and returning to the original retained draft. Checksum failure, unavailable
WebGL, texture allocation failure and actual WebGL context loss retained the
original renderer and usable React app. Tests wait for the real camera and
app-ready boundaries before pointer interaction.

The 29-command qualification set passed: `npm run check`, all **95 unit tests**,
native overview, rich Demo controls with GPU enabled, and every existing Pages
viewer gate (DOM, legacy, navigation, height, journeys, queues, file actions,
focus, Demo, touch, tablet, onboarding, population, overview quality/budgets,
readiness, static build/viewer and launch pages). It also included locale parity,
package/site privacy scans and both strict Claude manifest validations.
The final focused native suite passed after the texture-failure and pointer
checks were added. The tablet suite included 480 zoom samples and retained
its existing browsing-context and single-load checks. A repeated static build
initially refused an existing output directory; moving that previous generated
directory and building fresh passed without changing the export guard.

No functional regression was observed in these checks. This does not certify
all arbitrary third-party React apps, low-memory/physical mobile devices,
DPR 2/3 performance, or every source state of the private app. Native atlas
acceleration remains explicit opt-in; Web uses source DOM, selected/retained
cases use original runtimes, and private native assets remain excluded from
implicit static publication. See the [adapter contract](native-overview.md).
