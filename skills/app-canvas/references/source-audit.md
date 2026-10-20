# Strict all-source audit (`--complete`)

This stricter audit is separate from [UI landscape delivery](completion.md). Its
existing `--complete` requirements remain unchanged. Audit-only internal code
checks are not automatically missing screens; do not weaken them or report
a UI gate pass as an all-source audit pass. When requested, finish this work too.

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

UIKit toolbar/bar-item construction and `inputAccessoryView` attachment receive
explicit worklist entries, including Objective-C message and property syntax.
Trace their object lifetime as well as their source location. An accessory can
be nil during first render and become a real toolbar when a field is regenerated
after navigation or retry. Inspect first entry and the reachable reused-controller
path; map the visibly attached accessory, its real controls and dismissal state.
Allocation, an unattached object or the initial nil value does not establish
coverage of the later visible state. These lexical entries remain prompts for
source-driven inspection, not an exhaustive lifecycle or UI-state analysis.

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

For ordinary Android resource selection, fresh discovery can also identify a
version-only XML alternative that shadows a lower/default resource throughout
the module's literal minimum SDK range. This is limited to same-name drawable,
color, anim and animator XML under `src/main/res`, without additional qualifiers
or declared source-set overrides. The source build and replacement hashes remain
attached to the old tags. Keep every old file/region/element review; the selected
alternative still requires real UI evidence. Opaque SDK bounds, other qualifiers
and direct loading of a specific resource file need separate source/runtime
proof. See [Android resource selection](https://developer.android.com/guide/topics/resources/providing-resources#BestMatch).

For `values` XML, the filename is not a resource identity. Fresh discovery can
separately prove that an individual same-name **style bag** has a version-only
replacement throughout the module's literal minimum-SDK range. Only the lower
bag's declaration and own item tags receive this canonical proof, with exact
build, declaration and replacement hashes/offsets. Keep the file, regions, root,
neighboring entries, parents and selected replacement mapped and reviewed.
Duplicate or opaque XML, aliases, unsupported packaging/source-set changes and
recognizable custom package/table/file loading remain pending. The rule concerns
ordinary Android Resources selection; inspect the real build/capture boundary
before writing a specific non-UI reason. It never reviews the entry automatically,
proves an unused resource, or authorizes a hand-edited annotation to waive UI.
Literal standard resource shrinking does not remove individual alternative
configurations; explicit configuration filters still need separate proof.
See [Android resource optimization](https://developer.android.com/topic/performance/app-optimization/customize-which-resources-to-keep#remove-unused-alternative-resources).

Fresh discovery may also mark a narrowly recognized canonical Objective-C
initializer outcome `nonRenderingOutcome`: a nil return constructs no own UI,
and a completely empty `if (self) {}` body adds no branch-local UI effect. These
annotations still require specific source reviews. They do not waive the native
UI class, superclass construction, caller behavior, declarations or presentation
sites. Statements, fallbacks, later code and ordinary self guards are excluded;
editing a recorded annotation cannot replace the fresh source proof.

The native keyword scan also retains Java UI type imports in the worklist. A
complete Java `import` declaration may receive `nonRenderingOutcome` because
the declaration only binds a name. Constructors, calls, fields, the owning UI
file and imported implementation still require their own reviews and evidence;
an import followed by another statement receives no such proof.

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

## Supported Objective-C data effects

Objective-C discovery can mark a branch `nonRenderingOutcome` with kind
`objc-nonrendering-method` only after inspecting its enclosing supported method,
resolved source helpers and concretely bound continuations. This permits an
explicit, source-specific `nonUiReason`; it does not remove the source ID or
review it automatically. The method offset and native-source dependency digest
bind the annotation to fresh canonical discovery. Keep the owning UI file,
regions, caller UI effects and separate visible states mapped and reviewed.

The bounded model includes explicit Foundation data, SQLite and queue/task
contracts. It inspects callback bodies scheduled by those contracts. Unknown
calls, invoked unbound callbacks, escaping blocks, UI operations, opaque object
contents/casts, recursion and unsupported syntax remain unresolved. A generic
callback helper cannot inherit a data-only classification from one caller.
Unused local block bodies do not inherit an enclosing method's annotation.
Source overrides of modeled platform behavior, KVO callback registration,
custom shared network caches/protocols and runtime mutation prevent this analysis; it is not a claim of universal runtime noninterference,
IO success, callback timing or absence of later UI effects from stored data.
Do not copy an annotation into the inventory to create eligibility: the gate
uses fresh source discovery, not an inventory's self-asserted flags.

A second bounded annotation, `objc-stable-native-guard`, applies to a
contradictory nested `selectedSegmentIndex == 0` outcome. It requires an exact,
strong ivar binding to a standard Interface Builder `UISegmentedControl`, a
source-bound UI action or standard text-field Return delegate and a closed
synchronous interval between the enclosing and repeated reads. Any strings
used in that interval need inspected concrete Foundation producers and writer
checks; a declared object type is insufficient. Within this interval only, `UITextField.text` may be a
modeled data getter when a strong source ivar has only direct text reads and is
bound to a plain, unambiguous text field in every original scene. Source slot
writes/escapes, reflective access to that slot, runtime value injection, custom
text fields and source string subclasses prevent this capability. It relies on
UIKit's valid text-value contract; it does not model arbitrary invalid native
API values. It does not make general UIKit getters or text setters non-rendering.
An immutable property-list local can supply data only after an inspected standard
Foundation parse that dominates the outer guard, with a readonly local lifetime;
arbitrary dictionaries, mutable parses, aliases and pointer exports stay opaque.
Dormant blocks, unknown
receivers, callbacks, source helpers, UI effects, mutable receiver ownership,
reflective dispatch through unknown targets and runtime mutation remain
pending. Mixed Swift files must fit a closed data-declaration subset with no UI
capabilities, reflection, object escapes, string interpolation or unknown calls;
other Swift and unsupported native languages prevent this proof. Controller index setters and indirect writes remain unresolved. The interval
uses UIKit's main-thread control/action contract; it does not establish safety
for arbitrary off-main UIKit mutation or undefined native memory behavior. This does not waive the controller, enclosing
guard or reachable nested outcome, and does not review an ID automatically.

The Return delegate contract follows Apple's [UITextFieldDelegate method](https://developer.apple.com/documentation/uikit/uitextfielddelegate/textfieldshouldreturn(_:))
and [UIKit text-field isolation](https://developer.apple.com/documentation/uikit/uitextfield).
The bounded data summaries use the standard [`UITextField.text` value contract](https://developer.apple.com/documentation/uikit/uitextfield/text?language=objc)
and [immutable property-list contents](https://developer.apple.com/documentation/foundation/nspropertylistmutabilityoptions/nspropertylistimmutable).
Treat these as explicit framework contracts, not inferred purity of arbitrary getters.
All source and Interface Builder dependencies are fingerprinted by fresh
discovery; inventory annotations cannot establish their own eligibility.
