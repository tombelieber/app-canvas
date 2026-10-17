# Complete population contract

Read this before installing or populating App Canvas. The coding agent owns the
whole integration. The user's default request is one installation followed by a
populated landscape; it does not require them to list screens, write stories,
prepare fixtures or repeatedly ask the agent to continue.

## Discover independently, then reconcile

Inspect the whole first-party UI surface before selecting convenient examples.
Inventory entry points, navigation/redirects, screens, shared components,
dialogs/overlays, conditional rendering, state models, permissions, feature
flags, responsive/platform layouts and content-driven UI. Follow imports and
resource/metadata references beyond the initial UI folder. Cross-check code
discovery against actual app navigation and existing stories/tests/resources;
record unresolved dynamic destinations as blockers. A controller count or list
of routes alone is not the state denominator.

Record stable item IDs, kind, source paths plus symbols/locations, implemented
condition, applicable platform/layout and eventual canvas case IDs. Inspect all
implemented finite UI branches. For continuous inputs or repeated content,
record visually equivalent classes and boundary conditions with their source
justification; enumerate all content IDs without duplicating identical layouts.
Different outcomes, error messages, layouts or controls are distinct states.
Do not silently replace a feature family with one representative screen.

Scope comes from the user's repository and requested platforms. The agent must
discover it, not ask the user to enumerate it. Explain source-root choices and
non-UI classifications in `ui-review/README.md`. An unreachable declaration can
be classified using source evidence; inconvenience, missing credentials, old
code or rendering difficulty cannot justify exclusion. A smaller pilot needs
an explicit user request. Discovery uncertainty remains visible and incomplete.

## Populate and keep working

Create missing dependency injection, fixture data, preview entries or native
harnesses. Render original code with local synthetic dependencies. Preserve
the app's real authorization and business behavior. Inspect every output for
the intended condition, full layout, assets and source correspondence. Loading
states need controlled pending dependencies; fast APIs are not an excuse to
omit them. A component may map to its containing screen when the required
variant is visible and checked; it need not have a duplicate standalone card.

Maintain a durable pending list in the inventory. After a batch, process the
remaining items without asking "continue?". Check installed tool/version/API
support and resolve ordinary build issues yourself. Stop dependent work only
for an actual unavailable credential/device, unauthorized external action,
destructive data change, irreconcilable user-owned changes or product decision;
continue independent items. A blocker report is an incomplete handover, never
permission to drop the item or announce completion. Context limits and the
first successful screens are not stopping conditions.

## Machine-checked inventory

Full population requires the generated **version 2** worklist and `--complete`:
follow the [source walkthrough](source-audit.md). `discover` supplies `files`,
`obligations` and `sourceRoot`; `reviews` resolve each obligation into semantic
items or a specific non-UI explanation. Process every region and candidate.
The version 1 schema below remains compatible for construction/legacy checks,
but cannot pass full-population acceptance.

Use an installed tool revision that exports `@tombelieber/app-canvas/inventory`.
Pin that verified commit and lockfile. An older CLI must be updated rather than
silently omitting the gate. The fingerprint helper scans declared files and
directories; the agent supplies semantic discovery separately.

```js
import { inventorySources } from '@tombelieber/app-canvas/inventory';
const files = await inventorySources(process.cwd(), ['src/ui', 'src/router.tsx']);
// Inspect every file and its conditions before writing files + items to JSON.
```

```js
// canvas.config.mjs: required at final handover, in addition to routeCoverage
coverage: { requireSourceInventory: true, requireAllCases: true, requireConnected: true },
sourceCoverage: {
  roots: ['src/ui', 'src/router.tsx'], // all actual UI owners + relevant resources
  inventory: 'ui-review/inventory.json',
},
```

`inventory.json` has this structure; `files` comes from the helper above:

```json
{
  "version": 1,
  "files": [{ "path": "src/ui/Login.tsx", "sha256": "<actual SHA-256>" }],
  "items": [
    {
      "id": "login-denied",
      "kind": "state",
      "sources": ["src/ui/Login.tsx"],
      "condition": "invalid credentials returns the implemented error",
      "cases": ["login-denied"]
    }
  ]
}
```

Kinds are `screen`, `component`, `state`, `variant` and `navigation`. Each item
needs real source references and at least one existing case. Every catalog case
must map back to an item. Each scanned file needs an item, or a specific
`nonUiReason` on its file record when it contributes no UI. Keep non-UI reasons
auditable; categorizing an inconvenient UI file as non-UI defeats the contract.
A blocked item retains `cases: []` and a `blocker` explaining the actual missing
dependency. It fails the final gate. A placeholder absence panel does not make
the original UI rendered. During construction, keep the incomplete inventory
on disk; activate the strict config when reconciling the final population.

`--check` rejects missing mappings and new/modified/deleted source files in the
declared roots. Reinspect changes before refreshing hashes. Watch those source
roots and the inventory for refresh; never derive the denominator by merely
copying the catalog, delete a difficult item, narrow roots, disable checks or
blindly regenerate fingerprints to get green. The gate cannot prove the agent
chose sufficient roots or discovered every branch: semantic cross-checking and
output inspection remain required work.

## Final gate and delivery

1. Reconcile the source inventory against the complete catalog. Resolve every
   pending UI item and inspect every rendered state, including layout/platform
   variants and long/off-screen content. No unexplained omissions remain.
2. Resolve the version 2 worklist. Run `--complete` and project-native
   render/capture checks. Every case needs a distinguishing assertion; generic
   "body exists" or "image exists" checks cannot establish its intended state.
3. Demonstrate removing a state from both inventory and catalog still fails,
   and a new/changed source fails the gate, then
   restore them. Verify original-source edits refresh web UI or trigger native
   rebuild/recapture; a stale screenshot cannot prove the current source.
4. Deliver the working URL, discovered/rendered/pending counts by kind and
   platform, source/build/content revisions, actual checks and refresh commands.
   Zero unresolved required items is necessary to call population complete.
   Viewer tests, native render tests and full app E2E are separate results;
   unrelated production acceptance is not a canvas-population requirement.

Do not stop at an installed CLI, an inventory document, a proposed adapter,
representative screenshots or a passing self-selected catalog. Deliver the
landscape the user asked the agent to populate.
