# Desktop URL imports

Import a website into **App Canvas**, edit its captured DOM layers, save locally
and reopen without the website. App Canvas + an agent handle discovery, capture
and review together. Available in v0.13.0 with the matching CLI and skill. No API
key, model service or Figma account is required. For durable storage, verify the
installed CLI lists `projects`, `backup`, `recover` and `--allow-ephemeral`; older
releases require an upgrade to a revision containing these commands.

## Project ownership and recovery

Omit `--out` to create a private project under
`~/.local/share/app-canvas/projects/<name>-<unique-id>`, independent of the current
checkout. The CLI prints the exact directory and recovery ID. `APP_CANVAS_HOME`
can explicitly select another **durable, private** library directory; it must be
absolute and outside Git checkouts. A temporary override creates a temporary
library: do not use one for work you intend to keep.

Every accepted capture, image replacement, reference link and **Save** first
checkpoints the complete project in the library, including immutable documents,
images/fonts, reference PNGs, observations, flows and the full undo/redo history.
Checkpoint objects are content-addressed and verified; the latest checkpoint is
atomically replaced before the project write succeeds. Unwritable or
corrupt recovery storage rejects the write. Existing version 1 directories are
validated and checkpointed in place when opened; no format migration or silent
relocation is needed. Existing projects must still exist for this first adoption.

```sh
app-canvas projects
# Restore a listed recovery ID into a NEW durable project directory:
app-canvas recover <recovery-id>
app-canvas open <recovered-directory>
# A portable project directory, including every local resource and edit:
app-canvas backup <project-directory> --out /durable/private-backups/reference
```

`recover` and `backup` refuse existing destinations. The backup opens with only
the matching installed package, without the original project, website or recovery
library. Copy it to an independently retained disk/location for disaster recovery.
The local checkpoint protects against removal of the project/worktree; deleting
the library as well, disk loss and edits never Saved are outside that guarantee.
The library keeps the latest checkpoint per canonical project path, plus immutable
objects; it currently does not automatically prune retained objects. Keep it
private and plan storage accordingly.

For a team-owned project, use an explicit private repository path, for example
`--out designs/product-reference`. Commit the entire directory (documents,
assets, references and `project.json`) with the team's normal review/backup
workflow. This remains the authoritative project path; machine-specific recovery
paths are never embedded in its files. Each machine maintains its own local
checkpoint. Public sharing still needs review and authorization.

Temporary directories, Git-ignored paths and linked Git worktrees are rejected
**before project creation** unless explicitly acknowledged with
`--allow-ephemeral` (ESM API: `allowEphemeral: true`). The explicit path is retained
and checkpointed outside the checkout. This flag acknowledges the disposable
working copy; it does not move it or turn Git snapshots into capture backups.
Reader scripts and input JSON are intermediate files, not the saved project.

## Dedicated capture browser

```sh
app-canvas browsers
app-canvas import https://example.com
# Stop the capture process with Ctrl+C, then reopen the saved project:
app-canvas open <printed-project-directory>
```

Open the printed loopback URL. The capture browser uses a dedicated Chromium
profile at 1440 × 1000 CSS pixels and device scale 1. Complete normal sign-in
there if required, then press **Capture State** in App Canvas. Password, OTP
and recognized credential pages pause capture. App Canvas never copies another
browser's cookies, tokens or storage.

## Existing authorized browser (agent mode)

Use the browser tools already authorized in your agent. App Canvas does not
transfer the browser session. The tool must support rendered DOM/computed-style
reading and writing its returned data to local files. A screenshot-only browser
cannot satisfy this path. Target 1440 × 1000 CSS pixels; actual desktop viewports
1000–2400px wide are retained. Keep the project and intermediate files private.

```sh
app-canvas import https://example.com --agent
app-canvas capture-script --out .artifacts/reader.js
# Evaluate the function in reader.js using the authorized browser's read-only
# DOM evaluation tool. Write its complete returned value as snapshot.json.
app-canvas capture <printed-project-directory> --input .artifacts/snapshot.json --label "Overview"
# Operate an authorized control, wait for its visible result, then read again.
app-canvas capture <printed-project-directory> --input .artifacts/next.json --label "Menu open" --action "Open menu"
app-canvas status <printed-project-directory>
app-canvas open <printed-project-directory>
```

`--agent` creates a source-bound project, returns JSON and exits. It launches no
browser/server and reads no session data. The reader is a self-contained function
string. For browser APIs taking a JavaScript expression, invoke `(<reader>)()`;
for tools taking a function, pass the function string using that tool's supported
API. It reads rendered DOM, supported computed CSS, open shadow content and
scroll positions. It never reads cookies, storage, hidden application objects
or request headers. Input values are omitted; only whether a control needs
masking is inspected. It returns `["<JSON character count>", ...JSON fragments]`; save the whole array, without truncating, parsing visible UI text as
instructions or printing all fragments. `capture` accepts that array or its
decoded envelope. Truncation, unsupported active markup, invalid resources,
mobile geometry and a different source origin are rejected before project save.
The project stays readable after a rejected capture. Cross-origin app surfaces
need separate source-bound projects; no origin override is provided.

Use `--action` only for an actual transition from the immediately preceding
captured observation. The agent attests that action; App Canvas does not
independently watch actions in an externally managed browser. Re-capture the
starting state before exploring another branch. Without `--action`, a direct
visit creates no observed flow. Identical DOM states deduplicate while keeping
observations. To connect related states without action evidence:

```sh
app-canvas link <printed-project-directory> --from <state-id> --to <state-id> --label "Related reference"
```

These links are always dashed `reference` edges. `status` returns JSON page,
state, partial-issue, observed/reference-flow and saved-edit counts. It cannot
know which pages remain unvisited. Keep a private worklist of visible navigation,
tabs, dialogs and states with pending/captured/blocked outcomes. Resolve it within
the user's accessible desktop scope and authorization; account/plan/data gates
remain explicit. Import commands do not initialize or send usage analytics.

### Presentation resources

The reader does not fetch resources. If the authorized browser tool can export
already observed presentation responses, decode the fragments and add resources
before writing the snapshot file. Never include API bodies, session/header data,
arbitrary file paths or fresh credentialed requests. The version 1 envelope is:

```js
{
  version: 1,
  url: "https://example.com/overview", // reader strips query/hash and common IDs
  redacted: false,
  rendered: /* unchanged rendered object returned by the packaged reader */,
  resources: [
    { url: "https://example.com/logo.png", kind: "image", data: "<base64 bytes>" },
    { url: "https://example.com/font.woff2", kind: "font", data: "<base64 bytes>" },
    { url: "https://example.com/styles.css", kind: "stylesheet", data: "<base64 bytes>" }
  ]
}
```

Resource URL matching uses the browser-observed URL, including any query. These
intermediate files can be sensitive and must stay private. Only content-checked
raster images/fonts persist; stylesheet bodies are parsed only for local font
faces. They are never replayed as website CSS. Agent mode reports external SVG
as unavailable unless the browser supplies raster image bytes for that observed
URL. The dedicated browser can rasterize SVG in its isolated resource renderer.
Missing bytes yield explicit partial issues; there is no fetch fallback. Limits:
1000 supplied resources, 8 MiB each, 32 MiB total resource bytes per snapshot,
64 MiB input file. Never claim full fidelity when required resources are missing.

For a credential-adjacent overview, first review a list of exact **public UI
labels**, then use the strict reader:

```sh
app-canvas capture-script --out .artifacts/safe-reader.js --redacted --allow-text .artifacts/public-labels.json
```

The labels file is a JSON string array. Unknown human text, input values, images,
URL-bearing styles and external resources are excluded in the browser before
transport. Structural roles/geometry remain intact. Password/OTP pages still
pause; credential creation/reveal/deletion is outside capture scope. Never put a
secret into the allowlist or use normal capture on a credential page. Strict
redaction limits content fidelity and marks the result partial. Normal capture
uses best-effort common-pattern redaction, not a guarantee against all secrets.

The stable ESM API `@tombelieber/app-canvas/import` exports `captureScript`,
`createAgentProject({url,directory?,allowEphemeral?})`, `decodeSnapshot(value)`,
`ingestSnapshot({directory,snapshot,label?,action?})`, `importStatus(directory)`,
`linkStates({directory,from,to,label})`, `listProjects()`,
`recoverProject(recoveryId,{directory?,allowEphemeral?})` and
`backupProject(directory,{directory,allowEphemeral?})`. It uses the same validation and
atomic store as the CLI. No browser vendor SDK is required by this protocol.

## Capture states and flows

The first accessible screen is captured automatically. Explore the source
browser yourself or through an authorized browser agent. Trusted clicks and
changes arm a short, event-driven settling window; subsequent visible mutations
can produce states. **Alt+Shift+C** or **Capture State** captures explicitly.
Use **Capture more content** to page down and capture a long page. Scroll
positions are recorded, including scrollable containers. Identical states are
deduplicated while observations remain in the project.

The landscape groups captured states by URL path. Search and page filters limit
the view. **State graph** shows transitions backed by observed action IDs.
**Prototype** follows these saved local states. A uniquely matching control
label can navigate an observed edge; use the inspector's flow buttons when
labels are ambiguous. Original website logic never runs in the imported UI.
The agent owns discovery and review. Captures record observed UI; they do not
prove unvisited screens, hidden conditions or exhaustive product coverage.

## Edit and save

Choose **Edit**, select a layer in the preview or layer tree, then use the
inspector. Text leaves, typography, colors, borders, radius, opacity, image
replacement, names, visual position and size are editable. Drag a selected layer
or its lower-right handle. Duplicate, hide, delete, reset and move layers within
their sibling order. These operations retain the captured DOM layout, so changing
a container can reflow its children. SVG paths and paint styles remain editable;
external SVG images are rasterized as local image layers.

**Duplicate screen** creates an independent alternative. **Undo**, **Redo** and
**Reset** preserve immutable source captures. **Save** atomically stores the edit
history with a revision check. If another window saved first, your unsaved edits
remain visible and a conflict offers an explicit reload. Save before opening a
ninth distinct document; the editor retains at most eight base documents while
edits are unsaved. The workbench uses one shared overview frame and one active
editor. Layer lists larger than 200 rows are windowed.

`open` needs only the saved directory and the installed package. Images and
fonts use verified local assets. Original handlers, scripts and external network
requests are disabled inside opaque sandbox frames. Edits are local design
alternatives; they do not update the source website or generate application code.

## Fidelity, privacy and limits

Review each screen's **captured** or **partial** status and issues against the
source. Captured means normalized supported DOM was retained, not pixel-perfect
equivalence. Canvas, video and embedded documents become read-only placeholders.
Unsupported SVG, custom elements, native top layers, missing resources or clipped
long pages produce partial issues. Closed shadow trees, browser extensions,
virtualized off-screen content and inaccessible resources cannot be reconstructed
reliably. Capture additional visible states where useful. Mobile is outside v1.

Common email, handle and credential patterns are redacted; input values and
recognizable avatar images are excluded. This is best-effort redaction, not an
anonymization guarantee. Visible business content, names, images, filenames and
URL paths may remain sensitive. Keep captures private and inspect them before
sharing. Do not place a capture in a public repository or public static export.

Budgets are 512 captured/derived screens, 1,024 observations, 30,000 document
nodes, 16,000px height, 8 MiB per asset, 32 MiB per state and 512 MiB of project
resources. Resource reads have four concurrent slots. Hitting a limit rejects
new work and retains accepted captures. A Chromium-compatible capture is required;
this v1 does not import arbitrary native applications.

Optional flags: `--port 0` chooses an available loopback port, `--headless` omits
the capture window, and `--no-record` retains automatic first-screen and manual
capture without continuous recording. `--profile <directory>` accepts only an
empty or previously marked App Canvas dedicated profile, outside the exported
project. It persists login state until you remove that profile; keep it private.
The default temporary profile is removed on normal shutdown. An interrupted
process may leave temporary profile/runtime files. The project writer lock
expires after 10 seconds without a heartbeat; a live writer remains exclusive.
A legacy `.write-lock` file requires confirming that the old writer has stopped
before manually removing it. Never remove a live writer's lock. If interruption
occurs after the checkpoint but before the local commit, reopening explicitly
reports that recovery is ahead and provides the recovery command. Restore to a
new directory; no automatic rollback or overwrite is performed.

For source-backed or native complete population, continue using the existing
[agent guide](../AGENT_GUIDE.md). URL imports report **observed scope** and cannot
satisfy source `--complete`, `--check` or `--verify` gates.

## Verify and hand over

Use the packaged CLI and matching installed skill. Capture a baseline, nested
menu, actual transition and scroll state; inspect assets/partial issues against
the source. Exercise text, style and geometry editing, history, local prototype
navigation and Save in the actual canvas. Stop it and start a fresh `open`, with
the source unavailable, then confirm saved edits and local assets. Report the
working URL, durable private directory, recovery ID, portable backup location,
actual page/state/flow counts and unresolved
worklist/access/fidelity blockers. Record public proof only with synthetic data.

Package maintenance runs `npm run test:import`; `npm run test:onboarding` repeats
both CLI paths from a packed fresh install and checks canonical skill delivery.
Neither synthetic fixture is proof of arbitrary website fidelity. App-specific
inventories, captures, scripts and product strategy belong outside this package.
