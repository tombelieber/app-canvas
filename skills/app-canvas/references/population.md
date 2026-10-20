# Resumable population and UI evidence

These commands are provided by the tool revision containing this reference.
Use the matching `app-canvas guide`; update an older CLI instead of silently
skipping a gate. The coding agent still supplies semantic discovery and the
app-specific adapter. `populate` executes that adapter; it does not infer an
arbitrary application's states or call a model by itself.

## Independent worklist

```sh
app-canvas plan --source-root /path/to/app --out ui-review/ui-inventory.json
app-canvas status --inventory ui-review/ui-inventory.json
```

`plan` refuses to overwrite work. It fingerprints the whole original repository
and emits UI inspection anchors without source literals. Inspect all files,
including support code that determines UI, and add these fields:

```js
{
  // Keep generated version, files, anchors, exclusions, issues and sourceRoot.
  fileReviews: [{path: 'src/Login.jsx', role: 'ui',
    summary: 'Inspected initial, pending, invalid and signed-in states',
    states: ['login-ready', 'login-error']}],
  exclusionReviews: [{id: '<generated directory exclusion ID>',
    reason: '<verified dependency/generated-only directory>'}],
  states: [{id: 'login-error', kind: 'state', title: 'Invalid login',
    condition: 'Implemented invalid credentials response',
    pageId: 'login', feature: 'Sign in', platform: 'web', layout: 'phone',
    sources: ['src/Login.jsx'], cases: ['login-error'], status: 'covered'}],
  bindings: [{anchor: '<generated source anchor ID>', states: ['login-error']}],
  transitions: [{id: 'retry-login', from: 'login-error', to: 'login-ready',
    kind: 'recovery', label: 'Retry', journey: 'retry-login-flow'}]
}
```

File roles are `ui`, `support`, `content`, `asset`. A source with UI anchors
cannot be hidden as support. Every file needs a specific inspection summary;
use real source-specific reasoning, not a bulk “non-UI” template. A UI file must
map to related states containing that source. States need real page/feature
ownership matching their catalog cases. Opposite JSX render conditions require
distinct cases. Unresolved parse/source entries and uninspected excluded
application directories fail acceptance. Preserve pending states with blockers;
they remain incomplete. Syntax anchors do not replace semantic source and
navigation review, especially indirect/native state transitions.

`verifyUi({browser, preview, uiCoverage})` must run original-runtime state and
transition assertions, then return:

```js
{
  sourceDigest: uiCoverage.digest,
  cases: [{id: 'login-ready', runtime: 'web', buildId: '<actual build>',
    fixtureId: '<synthetic inputs>', assertions: [
      {id: 'ready-controls-visible', passed: true, sources: ['login-ready']},
      {id: 'retry-performed-and-controls-restored', passed: true, sources: ['retry-login']}
    ]}]
}
```

Every case needs distinguishing evidence for every mapped semantic state.
Action/recovery transition IDs also need original-runtime evidence at their
destination. For web, the transition must reference an authored continuing
journey that performs a real action and checks the destination; the viewer
executes it too. Native interaction evidence must come from the original device
runtime. Native proof entries also require `platform`, local capture `path` and
`sha256` as described in native.md. Missing, failed, unrelated, wrong-platform
or stale-digest evidence fails. Do not synthesize passed receipts from the
inventory. `verify` is a fallback if it supplies the same proof; a combined
hook may return `{ui: <proof>}`.

```sh
app-canvas --config ui-review/canvas.config.mjs --ui-complete --source-root /path/to/app
```

New UI deliveries above 128 cases start at feature depth, or page depth when
features also exceed 128. Existing projects may opt in with `initialDepth: 'auto'`
without migrating their inventory; `'0'`, `'1'`, `'all'` explicitly override the
starting depth. Grouping never grants UI/source acceptance or removes cases.
All cases need checked `kind: 'case'` journeys and a connected graph. A condition
edge means an independently seeded alternative, not a successful user action.
`routeCoverage` is checked as well. Sources/inventory are checked again after
runtime verification to reject mid-run drift. The strict `--complete` gate is
unchanged and separate; its pending count never means that many missing screens.

## Plan captures before actors

Import `planCaptures` and `populationFingerprint` from
`@tombelieber/app-canvas/population`. A capture request contains:

```js
{caseId, stateId, pageId, feature, entry, platform, layout, locale,
 sourceDigest, buildFingerprint, viewport: {width, height}, inputs,
 steps: ['enter', 'retry', 'recreate-field'], observe: ['keyboard', 'toolbar']}
```

Use structured steps where necessary; include every input that can change the
rendering or lifetime. Exact equivalent requests share one job and union named
**read-only** observations. All case IDs remain in the result. Different state,
inputs, error, locale, viewport, build/source or lifecycle cannot merge. Getter
names are not actions: changing a control must change `steps`/`inputs`.
Deduplication is never based on pixel similarity alone. Review equivalent
content classes and keep all content/source IDs independently auditable.
`surfaces` provides one display case per exact equivalent input and preserves
all evidence IDs; `caseMap` resolves those IDs to their retained case. Reconcile
inventory mappings and flow endpoints through that map before registering the
catalog. Do not create a separate visible node for each proof label. Existing
distinct lifecycle/state inputs remain separate surfaces.

## Durable executor

The config's `population` object or async `population({root})` returns:

```js
{concurrency: 2, checkpoint: '.artifacts/app-canvas/population.json', tasks: [
  {id: 'build-ios', kind: 'build', fingerprint: populationFingerprint(inputs),
   command: ['node', 'ui-review/build-ios.mjs'], cwd: '.',
   artifacts: ['.artifacts/app-canvas/build-receipt.json'],
   resources: ['xcode-derived-data:my-app'], timeoutMs: 300000},
  {id: 'capture-login', kind: 'capture', fingerprint: populationFingerprint(captureInputs),
   command: ['node', 'ui-review/capture-login.mjs'], dependsOn: ['build-ios'],
   artifacts: ['.artifacts/app-canvas/login.png'],
   resources: ['ios-simulator:<actual-UDID>'], timeoutMs: 300000}
]}
```

Kinds are `prepare`, `build`, `capture`. Commands are argument arrays, without
shell interpolation. Include source, build settings, tool/adapter version,
fixtures/content and logical viewport in input fingerprints. List every output
needed downstream. Adapters must restore device/fixture state in `finally`,
block production I/O, avoid credentials in inputs/logs and name real shared
resources identically across projects. Use one build per target/input revision,
and bounded independent platform preparation. Do not run a second writer or
actor in another chat.

```sh
app-canvas populate --config ui-review/canvas.config.mjs --source-root /path/to/app
# Same command resumes. --verify verifies then exits for CI.
```

The executor leases the project and device resources, runs bounded asynchronous
commands, saves atomic checkpoints and hashes outputs. Completed unchanged
artifacts are reused; changed inputs/commands/dependencies or artifact bytes
invalidate affected tasks. Interrupted work resumes. Unchanged failed tasks
stay failed until their cause/input changes; `retryFailed` is an explicit
adapter option for a diagnosed transient, not a retry loop. A busy actor stays
blocked. Independent work can finish. Logs are local/private under the
checkpoint directory. Never put private receipts in a public tool repository.

Final UI verification always runs afresh while project ownership is held.
Only its success records `ui-verified` and prints the working Canvas URL.
Without `--verify` that verified viewer stays open; with it the viewer closes.
A completed capture queue by itself is only `ready-for-ui-verification`.
See the runnable React/Vite `delivery.config.mjs` and `prepare.mjs`. Its explicit
source review is example-specific; do not copy its states/reviews into another app.
