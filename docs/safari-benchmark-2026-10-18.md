# iPhone Safari benchmark — 2026-10-18

The tested optimization bundle was **not admitted**. It produced a small FPS
increase and a higher sampled WebContent footprint. This publication retains
the already deployed runtime. These results do not establish state-of-the-art
performance or a lower memory ceiling.

The baseline is `cb2b936` (public demo version 0.10.2), **after** the earlier
Safari crash fix in PR #2. This is an incremental comparison, not a benchmark
against the old crashing 0.6.x renderer.

## Physical device results

iPhone 13 Pro, iOS 18.6.2. Each cell is the median of three per-trial results,
with the observed range in parentheses.

| Metric | Public baseline `cb2b936` | Candidate `b8432d8` |
| --- | ---: | ---: |
| Native Core Animation FPS | 49.06 (48.88–49.31) | 49.75 (49.69–50.38) |
| rAF callback cadence, FPS | 49.47 (49.27–49.60) | 49.66 (49.52–50.11) |
| rAF interval p99, ms | 130 (124–138) | 146 (129–153) |
| Sampled WebContent peak footprint, MiB | 1,703 (1,515–1,911) | 1,971 (1,782–2,050) |

All six measured motion windows completed without reloads or recorded errors.
This is bounded stress-test evidence, not a guarantee against future crashes.
[Aggregate measurements and per-trial results](https://github.com/tombelieber/app-canvas/blob/main/docs/safari-benchmark-2026-10-18.json)
contain no device identifiers, personal content, private URLs or raw traces.

## Method and limits

The order was A–B–B–A–A–B. Both variants used byte-identical source documents
for all 77 cases: 74 shared DOM previews and three isolated native-dialog HTML
previews. Their original app frame code was also identical. Every trial waited
for all 77 previews, then ran three cycles of two-stage zoom-in (the second
stage adds horizontal pan), zoom-out and return, with 1,500 ms per phase and approximately 60 Hz scripted
DOM touch input through the real gesture handler. The maximum zoom was 500%.
The viewport was 390 × 663 CSS pixels at DPR 3.

Native Instruments services supplied whole-display Core Animation FPS and
process physical footprint at 500 ms memory intervals. Display-FPS samples
omit one second at either edge of each motion window. rAF intervals are
reported separately; neither metric is a panel scanout trace or a measurement
of trusted native pinch latency.

Memory is the sampled footprint of the WebContent process dominating CPU
during the workload. It can include retained contexts, browser caches and
charged graphics memory. It is not an exact per-page allocation total. Other
WebContent processes and GPU-process footprint were not added to it. Short
peaks between samples can be missed. The existing Safari profile and
extensions stayed enabled; thermal state and power mode were not recorded.
Only one physical iPhone was tested. iPad layout and interaction checks used
WebKit emulation; **there is no physical iPad performance result**.

## What was investigated

The candidate combined fewer repeated renderer writes with stable preview
membership and narrower viewport subscriptions. A deterministic test removed
30 unnecessary workbench-consumer renders during 30 camera updates, while
still updating when the visible source set changed. That local improvement
did not establish an overall device-level performance improvement.

Additional same-page replay, temporarily hidden native-dialog previews and
viewport clipping experiments did not demonstrate a repeatable memory win.
Those experimental rendering changes were not adopted. A smaller follow-up
candidate completed its motion windows but recorded an unclassified JavaScript
error during the transition away from a baseline trial, so it failed clean-run admission and was
not released either. The error's origin remains unresolved.

The existing runtime remains the published choice. Further optimization needs
a clean physical-device result that improves the measured envelope while
preserving the real UI and interactions. Reducing React render counts alone
is insufficient. The [React Flow performance guidance](https://reactflow.dev/learn/advanced-use/performance)
is useful implementation guidance, not evidence that a particular bundle is
faster on Safari.
