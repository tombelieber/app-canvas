# Source walkthrough and population acceptance

Start before choosing convenient canvas cases:

```sh
app-canvas discover --source-root /path/to/application --out .artifacts/app-canvas/inventory.json
app-canvas pending --inventory .artifacts/app-canvas/inventory.json
```

`discover` writes a new version 2 worklist and refuses to overwrite existing
work. It walks the whole supplied directory, rather than `sourceCoverage.roots`.
Use the user's original application repository, accounting for every platform
and build target. The snapshot records that root relative to the inventory.

## Resolve the queue

The worklist contains fingerprints, 80-line reading regions, conditional
outcomes, JSX, native presentation sites, XML scenes/destinations and JSON
records. Unfamiliar text files receive reading regions; binary resources receive
file obligations. Source text and literal values are never emitted.

Read every region and follow imports, state inputs, navigation, resources and
data dependencies. Syntax candidates are inspection prompts, not an exhaustive
semantic state inventory. JavaScript/TypeScript use the TypeScript parser;
other source uses conservative lexical candidates. Enumerate additional states
in `items`, including database/remote content IDs and justified boundaries.
Opaque or unresolved dependencies remain blockers until inspected.

Add one review per generated obligation:

```json
{ "id": "<generated ID>", "items": ["login-denied"] }
```

Semantic `items` use the completion contract's schema. Their `sources` must
include the obligation's path and their `cases` identify original rendered
states. Every scanned file needs an item or a file-level `nonUiReason`.
Regions/components may share a containing screen when its evidence covers them.
Set each item's `platform` from the actual build target when source is shared
or its platform is ambiguous; language alone does not identify an Apple target.

An obligation without a UI contribution uses:

```json
{ "id": "<generated ID>", "nonUiReason": "<specific source-based explanation>" }
```

Review generated-directory exclusions against actual build inputs; `.git` and
`node_modules` are tool internals. Presentation sites and XML/JSX UI cannot be
waived as non-UI. A branch marked `unreachable` by fresh discovery may receive a
specific non-UI review: the tool verifies a literal Android minimum SDK from the
nearest module or explicit iOS native product deployment targets in the nearest
unambiguous Xcode project. It includes flavor and extension floors, fingerprints
the build file, and keeps dynamic/inherited/ambiguous bounds pending. Editing a
snapshot to add this annotation cannot waive a branch. Review the declared build
bounds against the actual build/capture manifest; unsupported guard expressions
remain inspection work. In a rendering source, opposite reachable outcomes require
separate fixture cases; identical pixels may represent different conditions.
Do not invent different UI to satisfy a structural branch.

Fresh discovery also recognizes a canonical empty Android `res/values*` XML
container as non-rendering: it declares no resources. Keep its file, region and
element obligations and give each a specific source-based non-UI explanation.
Attributes, active children, other directories and opaque XML retain their UI
review requirements; a recorded annotation cannot override fresh source.

Keep blocked obligations with a `blocker`. `pending` returns the next ten unread
obligations and the remaining count. Resolve them, populate their semantic
items and original-runtime evidence, and continue. A zero reading count is not
successful population. Source changes invalidate their fingerprints and IDs:
generate a fresh snapshot at a new path, inspect changes, and preserve reviews
only for unchanged IDs. Never refresh fingerprints merely to get green.

## Final acceptance

```js
sourceCoverage: { inventory: '.artifacts/app-canvas/inventory.json' },
coverage: { requireSourceInventory: true, requireAllCases: true, requireConnected: true },
```

Keep the incomplete worklist while building; activate `sourceCoverage` when its
reviews and mappings are ready. Final handover runs:

```sh
app-canvas --config ui-review/canvas.config.mjs --complete --source-root /path/to/application
```

Use the same original source root; acceptance rejects a snapshot of a different
directory. Omitting `--source-root` requires a snapshot of the current directory.
This forces all three flags, requires version 2, recomputes discovery from the
recorded root, rejects removed/unreviewed obligations, checks every case and
journey, and requires source-linked runtime evidence. It rechecks sources after
verification. `--check` and `--verify` remain construction checks.

The `verify` hook receives `sourceCoverage.digest` and `requiredEvidence`.
Return records produced by actual state checks, not an all-passed map:

```js
return {
  sourceDigest: capturedSourceDigest,
  cases: [{
    id: 'login-denied', runtime: 'native', platform: 'ios',
    buildId: recordedBuildId, fixtureId: 'invalid-login',
    capture: { path: '.artifacts/app-canvas/evidence/login-denied.png', sha256: captureSha256 },
    assertions: [{
      id: 'invalid-credentials-message-visible', passed: nativeAssertionPassed,
      sources: observedObligationIds,
    }],
  }],
};
```

Capture paths are relative to the integration working directory. Native records
require an intact local image and platform/build/fixture identity. A comparison
case can have separate records for each platform. Web records use `runtime:
'web'` and original DOM assertions, without a native capture. Every case and
UI-mapped obligation requires evidence. Record the source digest during build/
capture; never attach a current digest to an old capture. The gate validates
bindings and integrity; harness correctness and semantic inspection remain
engineering responsibilities. Unavailable prerequisites stay incomplete.
