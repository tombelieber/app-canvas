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
| `file` | `selector`, `asset`, optional `name`, `mime` | Load a reviewed same-origin `./` synthetic asset. |
| `expect` | `selector`, optional `text`, `value`, `checked`, `hidden` | Wait for a matching DOM state. |
| `fault` | `path`, `method`, optional `network`, `status`, `error`, `count` | Fail a bounded synthetic API request. |

Selectors use `document.querySelectorAll` CSS syntax, not Playwright's selector
extensions. Actions wait for DOM changes, with an optional `timeout` in
milliseconds (default 8000). Values/files are public fixture data if exported.
The runner performs DOM actions, not browser-level user-input simulation;
keep real pointer, keyboard, layout and application E2E checks in the adapter.

Fault injection requires `window.__appCanvas.synthetic === true` (set by
`installPreview`) or `window.__review.synthetic === true`. It wraps the current
synthetic fetch transport, matches a `/api/` path and method, and fails 1–10
requests. A `:segment` matches one path segment. Set `network: true` for a
rejection, otherwise a synthetic response defaults to status 503. It does not
enable a live backend. SDK calls need fixture support at their own boundary.

The [StoolSense journeys](../examples/stoolsense/journeys.json) exercise normal
save, a failed save with draft preservation/retry, and an analysis request
failure/retry. All records and photo assets are synthetic. These checks do not
qualify medical output or any AI model.

In the canvas, select a journey, then play, pause between steps, single-step,
change delay, replay with fresh fixtures or stop. Other named previews keep
their own state. Manually following a flow leaves playback and focuses that
named case. Escape exits in-canvas interaction; reset restores the selected
case, or restarts the current journey with fresh fixtures.
