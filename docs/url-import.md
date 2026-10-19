# Desktop URL imports (unreleased)

Import a website into **App Canvas**, edit its captured DOM layers, save locally
and reopen without the website. This development feature is available from a
checkout containing the `import` and `open` commands; the published v0.10.3 pin
does not include it. No API key, model service or Figma account is required.

```sh
npm ci
node bin/app-canvas.mjs browsers
node bin/app-canvas.mjs import https://example.com --out .artifacts/product-reference
# Stop the capture process with Ctrl+C, then reopen the saved project:
node bin/app-canvas.mjs open .artifacts/product-reference
```

Open the printed loopback URL. The capture browser uses a dedicated Chromium
profile at 1440 × 1000 CSS pixels and device scale 1. Complete normal sign-in
there if required, then press **Capture State** in App Canvas. Password, OTP
and recognized credential pages pause capture. App Canvas never copies another
browser's cookies, tokens or storage.

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
This is a recording workflow; it does not autonomously discover all product
screens, conditions or navigation.

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

Budgets are 128 captured/derived screens, 200 observations, 30,000 document
nodes, 16,000px height, 8 MiB per asset, 32 MiB per state and 256 MiB of project
resources. Resource reads have four concurrent slots. Hitting a limit rejects
new work and retains accepted captures. A Chromium-compatible capture is required;
this v1 does not import arbitrary native applications.

Optional flags: `--port 0` chooses an available loopback port, `--headless` omits
the capture window, and `--no-record` retains automatic first-screen and manual
capture without continuous recording. `--profile <directory>` accepts only an
empty or previously marked App Canvas dedicated profile, outside the exported
project. It persists login state until you remove that profile; keep it private.
The default temporary profile is removed on normal shutdown. An interrupted
process may leave temporary profile/runtime files or a `.write-lock`; confirm
the owning process has stopped before manually removing its stale lock. Never
remove a live writer's lock.

For source-backed or native complete population, continue using the existing
[agent guide](../AGENT_GUIDE.md). URL imports report **observed scope** and cannot
satisfy source `--complete`, `--check` or `--verify` gates.
