# Live screens and journey playback

`flows` are labeled connections between independently seeded catalog cases.
Clicking a connection selects its destination and pans/zooms there. A `journey`
instead runs controls and assertions in one continuing preview session, then
moves that session and the camera to each confirmed catalog state. It is not
a slideshow of screenshots or separately seeded pages.

Add an optional `journeys` array to `canvas.config.mjs`:

```js
journeys: [{
  id: "save-task",
  title: "Save a task",
  entry: "tasks-empty",
  steps: [{
    title: "Add and confirm the task",
    screen: "tasks",
    actions: [
      { type: "fill", selector: "#task-name", value: "Synthetic task" },
      { type: "click", selector: "#add-task" },
      { type: "expect", selector: "#task-list", text: "Synthetic task" },
    ],
  }],
}],
```

`entry` and every `screen` must be registered catalog IDs. Steps have a title
and 1–20 actions; a journey has 1–100 steps. Give each step an assertion so the
destination names a confirmed state. Errors stop playback at the last
confirmed state and show the failed selector. `--verify` runs the same authored
actions through the same player, failing on a journey error.

| Action | Fields | Meaning |
|---|---|---|
| `click` | `selector`, optional `text` | Click a visible enabled element. |
| `fill` | `selector`, `value` | Set an input/textarea and dispatch input/change. |
| `check` | `selector`, optional boolean `value` | Check a radio/checkbox; false unchecks. |
| `select` | `selector`, `value` | Select an option and dispatch input/change. |
| `file` | `selector`, `asset`, optional `name`, `mime`, `replaces` | Load a reviewed same-origin `./` synthetic asset; optionally wait for a replacement DOM node. |
| `expect` | `selector`, optional `text`, `value`, `checked`, `hidden` | Wait for a matching DOM state. |
| `fault` | `path`, `method`, optional `network`, `status`, `error`, `count` | Fail a bounded synthetic API request. |

Selectors use `document.querySelectorAll` CSS syntax, not Playwright's selector
extensions. Actions wait for DOM changes, with an optional `timeout` in
milliseconds (default 8000). Values/files are public fixture data if exported.
The runner performs DOM actions, not browser-level user-input simulation;
keep real pointer, keyboard, layout and application E2E checks in the adapter.
When selecting a file replaces an existing form asynchronously, set
`replaces: "#map-form"` on the file action. It waits for a different visible
node after dispatching the file change, so a still-visible old form cannot
be mistaken for the new mapping. For in-place updates, assert a distinguishing
value or output before the next operation. Do not use fixed sleeps as readiness.

Fault injection requires `window.__appCanvas.synthetic === true` (set by
`installPreview`) or `window.__review.synthetic === true`. It wraps the current
synthetic fetch transport, matches a `/api/` path and method, and fails 1–10
requests. A `:segment` matches one path segment. Set `network: true` for a
rejection, otherwise a synthetic response defaults to status 503. It does not
enable a live backend. SDK calls need fixture support at their own boundary.

The [StoolSense journeys](../examples/stoolsense/journeys.mjs) exercise 44
interaction flows and all 77 named cases: recording, drafts, rejections,
retries, edits, deletion/cancellation, imports, exports, profiles, care-reference
variants and authentication. All records and photo assets are synthetic. These checks do not
qualify medical output or any AI model.

In the canvas, select a journey, then play, pause between steps, single-step,
change delay, replay with fresh fixtures or stop. Other named previews keep
their own state. Manually following a flow leaves playback and focuses that
named case. Escape exits in-canvas interaction; reset restores the selected
case, or restarts the current journey with fresh fixtures.

## Whole-app state graph and complete playback

The **畫面總覽** view displays the full live UI of every registered case.
**狀態圖** lays out the combined directed graph with compact state cards;
select a card to expand the same real UI, then double-click to interact.
`outcome` gives a state its semantic label and color: `neutral`, `success`,
`failure`, `pending` or `warning`. An optional `condition` explains its inputs.
Color describes the application state, not whether a test passed or a medical
result is correct. Unknown outcome defaults to neutral.

Graph edges combine `flows` and authored journey transitions. A flow edge's
`kind` is `action` (default), `recovery`, `condition`, or `reference`.
Conditions/references are dashed and labeled; they do not pretend to perform
an app operation. A checked journey's operation takes precedence over a
reference for the same source/destination. Failed-to-successful transitions
are shown as recovery. The selected path can retain other branches with
**顯示其他分支**. Connections always select and focus their named destination.

Use `kind: "case"` for a standalone condition:

```js
{
  id: "expired-case", kind: "case", title: "Expired session",
  entry: "auth-expired", condition: "Synthetic identity returns 401",
  steps: [{
    title: "The private UI is locked", screen: "auth-expired",
    actions: [{ type: "expect", selector: "#locked:not([hidden])" }],
  }],
}
```

It starts from the named fixture and checks that actual view. This is useful
for permission boundaries, loading, component options and external outcomes.
It does not assert that an imaginary click caused that condition. `kind:
"flow"` (or omitted) is a continuing interaction flow. Every destination
should have an assertion for the state it claims to reach.

The picker can play all flows, all individual cases or the entire set.
Each flow preserves one continuing session; crossing into the next flow/case
creates a fresh session. Single-step pauses across those boundaries too.
Errors stop the queue and retain the last confirmed state; replay starts over.
Pause finishes any already-running action before the next step. Playback
does not make real authentication, backend behavior or device permissions
synthetic-proof equivalents.

Enable `coverage: { requireAllCases: true, requireConnected: true }` in the
project config. Every catalog state then needs a `kind: "case"` journey with
an `expect` on that state, and must belong to the connected combined graph.
The UI counts authored coverage; completion counters describe only the
current playback run. A new state without its reviewed case or connection
fails the CLI check. Existing configurations keep working without the guard.
