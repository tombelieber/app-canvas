# Desktop URL capture into App Canvas

Use this path when given a website URL and asked for an editable product
landscape. **App Canvas + the agent** own the workflow: the agent discovers and
operates authorized UI; App Canvas captures, edits, links, saves and reopens it.
The output is an App Canvas project. For repository input, use the separate
source/native complete-population contract.

Use App Canvas v0.13.0 or later with its matching skill. The CLI help lists
`import`, `capture-script`, `capture`, `status`, `link`
and `open`. For durable storage also require `projects`, `backup`, `recover`
and `--allow-ephemeral` in the installed CLI; upgrade to a verified revision
containing them when absent. v0.12.0 predates this workflow. Run `app-canvas guide` for the
installed contract. Read the matching package's `docs/url-import.md`; never assume a newer skill upgrades an older CLI.

## Choose the browser

- **Existing authorized browser:** prefer `import <URL> --agent`. Use the agent's supported browser tools and the packaged read-only
  `capture-script`. This preserves the user's existing sign-in without copying
  cookies, profiles, tokens or storage. The tool must expose rendered DOM and
  computed styles; screenshots alone cannot produce editable DOM layers. Report
  unsupported browser access as a blocker instead of reconstructing invented UI.
- **Dedicated capture browser:** use `import <URL>`.
  Complete normal sign-in there, then use Capture State / Alt+Shift+C. It uses
  1440 × 1000 Chromium. Never inspect another browser's profile files.

Both paths use the same project, editor, local assets and save format. Desktop
only: target 1440 × 1000; other observed desktop widths from 1000–2400px retain
their actual viewport. No mobile capture is implied.

## Own the project durably

Omit `--out` by default. Use the returned durable project directory under
`~/.local/share/app-canvas/projects`, outside disposable checkouts. An explicitly
configured `APP_CANVAS_HOME` must itself be durable and private. Respect a user's
explicit `--out` without relocation. Repository-owned projects are supported:
keep all documents/assets/references/metadata in the authorized private team repo
and use its normal commit/review workflow.

Never introduce `--allow-ephemeral` for an important long-running project merely
to bypass a rejected path. Explain the temporary/ignored/worktree risk before
creating one; use it only when the user explicitly chose that disposable working
copy. The ESM equivalent is `allowEphemeral: true`. Automatic checkpoints still
live in the independent library and cover capture, assets, links and Save.
Existing projects are adopted in place on open; protect them before cleanup.

Use `projects` to find the recovery ID even after a worktree disappears, then
`recover <id>` and `open <returned-directory>`. `backup <dir> --out <new-durable-dir>`
exports a self-contained project; verify it can reopen and hand over its location.
The original checkout and source site must not be required. Keep that backup in
an independently retained location for disk/library loss. Local checkpoints
cannot protect unsaved edits or deletion of both the project and the library.

## Execute the scoped landscape

1. Inspect the visible navigation and authorization. Maintain a private worklist
   of pages, tabs, menus, dialogs and distinguishing states, with pending,
   captured and blocked outcomes. Explore the scoped accessible desktop UI until
   that worklist is resolved. Account for account/role/data/plan boundaries.
   Do not publish, send, invite, connect accounts, pay, accept agreements or
   create records without authorization. Reuse authorization already given;
   inspect autosave before entering text. Never reveal/create/delete credentials.
2. Capture a settled baseline, then each distinguishing visible result of an
   actual authorized action. For the agent browser, write the full reader result
   to a private JSON file and run `capture <dir> --input <snapshot.json> --label
   <state-name>`. Do not print huge snapshots. Preserve all length-prefixed
   fragments; the importer rejects truncation. Attach only already observed
   image/font/stylesheet bytes using the documented resource envelope. No API
   responses, headers, session state or background credentialed downloads.
3. Pass `--action <label>` only if that action actually led from the immediately
   preceding captured observation to this state. Re-capture the correct starting
   state before branching to another action. A direct visit without observed
   transition gets no action. Use `link` for explicitly labeled **reference**
   relationships; never invent observed flows or claim replay executes the app.
   Capture nested menus, visible scroll positions and meaningful transitions.
4. Review `status`, partial issues, assets and actual rendered screens against
   the source. For a credential-adjacent overview, use `capture-script --redacted
   --allow-text <public-labels.json>` only after inspecting its safe labels.
   Unknown text, inputs and images are masked before transport; password/OTP
   surfaces still pause. Exclude credential lifecycle. Keep the normal reader
   away from credential screens; its common-pattern redaction is best effort.
5. Open the project, verify representative text/style/geometry editing, history,
   local flow navigation and **Save**. Stop the process, run a fresh `open <dir>`,
   and verify the edits and assets persist with the source disconnected. Hand
   over the working canvas URL, durable private directory, recovery ID, verified
   portable backup location, observed page/state/flow
   counts, worklist outcomes, exercised controls and remaining access/fidelity
   blockers. A saved file alone does not prove edit or reopen behavior.

## Honest completion and privacy

`status` reports observed scope, never exhaustive product coverage. “Finished”
means the agreed accessible worklist is resolved and save/reopen was verified;
list blocked/inaccessible and unsupported regions separately. Do not infer hidden,
paid, permission-gated, data-dependent or unvisited states. Captured means
supported DOM was retained, not pixel-perfect reconstruction. Canvas, iframe,
video and unsupported resources remain explicit partial/read-only regions.
Website scripts do not run in the imported prototype; observed links navigate
saved local states. URL imports cannot satisfy source `--complete`/`--verify`.

Keep all app-specific captures, inventories, profiles, strategy, automation and
verification artifacts outside this public package. Store projects privately;
inspect text, URLs and image pixels before any separately authorized sharing.
Do not name private trials in public docs, tests, demos or commit messages.
Use synthetic, publishable data for package verification and public examples.
