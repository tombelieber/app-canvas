# Complete UI landscape delivery

The user supplies a repository. Deliver one working overview of everything the
app can visibly do, grouped by real page/feature and connected by named flows.
Own discovery, fixtures, original-runtime rendering, population and verification.
Do not ask the user to list screens, write stories or keep saying “continue”.
A few representative screens are an intermediate result.

## Discover before capturing

Run `agent-canvas guide` from the installed package to use matching instructions,
then `plan --source-root <original-repository> --out <new-ui-inventory.json>`.
Inspect the whole first-party repository: entry points, imports, navigation,
controllers, resources, state inputs, permissions, feature flags and content.
Cross-check the source against runtime navigation and existing stories/tests.
Inspect every file; follow UI dependencies beyond the initial UI folder. The
worklist is independent of the catalog. Its syntax anchors are inspection
prompts, not an exhaustive semantic state enumerator. An unknown dynamic
route/condition remains an unresolved UI blocker, never a support-file waiver.

Enumerate implemented finite visible states: populated/empty, loading, distinct
errors and recovery, denied, forms, overlays, media/download/update states and
completion. Follow first entry, back/retry and reused controller lifetimes;
a late attached keyboard accessory is a state even when it was initially nil.
Keep distinct outcomes, controls, layouts and messages. Shared components may
map to containing screens when every distinct variant is visible there.

Use the app's actual platform targets. Start with supported phones; add tablet
cases only for distinct implemented tablet layouts/behavior. Do not multiply
all cases by every resolution or invent iPad support. Treat screen size as a
variant under the page/feature. Enumerate repeated content IDs and validate
content/boundaries without duplicating the same UI/flow per record. Do not
collapse meaningful user-visible differences.

## Populate autonomously

Create missing harnesses/fixtures at existing dependency boundaries and render
original UI. Fixtures supply data, identity, pending/failure outcomes and
isolated mutations, never duplicate screen markup. Keep external requests
blocked and production sessions/data/providers out. Native captures follow
[native.md](native.md), including source/build provenance and real device
interaction evidence. A screenshot viewer's buttons are not native controls.

Use the durable [population workflow](population.md): plan exact equivalent
captures before device work, union read-only observations, build once per
changed input and resume from checkpoints. One actor owns each device and
project writer. Avoid competing chats or repeated builds/captures for evidence
labels alone. Continue independent work after a genuine blocker. Fix a failed
cause before retrying; do not loop on an unchanged error.

Declare `pages` from actual navigation and `pageId`/`feature` on every case.
Keep an overview of the whole app, with page → feature → state navigation;
size/platform are secondary variants. Reuse the viewer's group/depth filters
and bounded preview pools. Preserve original DOM, Demo/Play, clickable flow
links, retained drafts and isolated reset.
New UI deliveries above 128 cases open at page/feature depth; above 128 features
they open at page depth. “All states”, search and links still reveal every case.
Existing integrations keep their starting view. This is a browsing default,
not a reduction in population, graph or evidence coverage. Draw `condition`/`reference` links
for seeded variants; label actual user actions and recoveries separately.
Author checked case journeys and continuing action/recovery journeys. A drawn
edge alone is not interaction evidence.

## UI gate and strict source audit are separate

Configure `uiCoverage: { inventory: 'ui-review/ui-inventory.json' }` and
`coverage: { requireAllCases: true, requireConnected: true }`. Follow the
inventory schema and original-runtime `verifyUi` proof in [population.md](population.md).
Run `--ui-complete --source-root <original-repository>` for UI delivery, or
`populate` for resumable preparation followed by the same fresh gate.

UI delivery requires every file inspected, every discovered UI anchor bound,
every semantic state rendered and checked, actual grouping, connected cases,
and checked transitions. Omitted source UI cannot disappear merely because it
was left out of both the inventory and catalog. New/changed source invalidates
the snapshot. Never blindly refresh hashes, delete difficult states, narrow the
source root or label rendering source “support” to pass. Inspect each rendered
state for its distinguishing condition, assets, long content and layout.

`--complete` retains its existing stricter **all-source audit** contract:
[source-audit.md](source-audit.md). It still requires every generated region,
predicate and obligation reviewed, with obligation-linked runtime evidence.
An internal telemetry branch may be audit work without being a new screen.
Report audit pending separately from missing UI. Never turn a failed
`--complete` into a pass by renaming it, relaxing its rules or reporting UI
acceptance as source-audit acceptance. If the user requests both, finish both.
Legacy version 1 source inventories remain construction checks only.

## Final delivery

1. Reconcile the independent source/UI inventory and inspect every actual case.
   Zero missing UI and zero unresolved UI suspects are required for UI delivery.
2. Run the actual installed package path and original-runtime checks. Verify
   Demo/Play, flow navigation, retained input, reset and platform/layout variants.
3. Prove a state omitted from both inventory and catalog fails; prove source
   drift and missing state/transition evidence fail. Restore and rerun the gate.
4. Deliver the working URL, page/state counts, grouping, what the app can do,
   refresh command and any genuine blockers. Keep source audit status separate.

Do not stop at an installed tool, inventory report, proposed adapter, subset or
passing self-selected catalog. A real unavailable credential/device, unauthorized
external action, destructive data change, irreconcilable user-owned edit or
product decision can block dependent work. Bundle only necessary questions;
continue everything else. Context limits are not a completion condition.
