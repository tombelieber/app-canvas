# Native capture overview

An adapter can opt captured native UI into a shared GPU overview. Web previews
continue to use source-rendered DOM. The existing case registry, layout, DOM
labels and flow connections, selection, continuing journey player, and retained
running frames own their existing behavior. The accelerator paints images only.

## Adapter contract

The application prepares and serves a reviewed atlas derived from its original
native captures. Return this optional capability from `preview(ctx)`:

```js
return {
  url: screen => `${ctx.canvasOrigin}/native-case/${screen.id}`,
  nativeOverview: {
    url: "/reviewed-native-atlas.webp",
    sha256: atlasSha256,
    width: 2048,
    height: 2048,
    cases: [{
      id: "native-login-empty",
      x: 0, y: 0, width: 30, height: 64,
      sourceSha256: originalCaptureSha256,
    }],
  },
  handle(req, res, url) { /* Existing allowlisted originals and atlas. */ },
};
```

Only explicitly listed cases use the atlas; a mixed Web/native catalog is valid.
Every ID must belong to the catalog, each ID appears once, each rectangle is
inside the atlas, and both digests are lowercase SHA-256. The atlas URL must be
on the Canvas origin, without credentials. Each dimension is at most 4096 and
decoded RGBA size is at most 32 MiB. The client verifies the atlas digest before
decoding, checks decoded dimensions, and respects the device's texture limit.

`sourceSha256` records provenance; it does not itself prove that a rectangle is
the correct source UI. The adapter's existing source-linked verification must
bind each atlas cell to its original capture and include every meaningful
screen/state. Validate source/build/capture provenance, image orientation,
mapping and pixels independently. An atlas never replaces `--complete`, source
inventory, native runtime evidence, or the original full capture.

App-specific inventories, atlas generation and private captures stay in the
target app. The shared package does not scan an app for screenshots or turn
arbitrary React/HTML components into images.

## Behavior and fallback

Large captured catalogs use wider page groups matched to the available board
area, so whole-app fit does not reduce short captures to subpixel strips. Page
ownership and the state graph remain intact; ordinary Web layout is unchanged.
At overview scale, all declared captures can be drawn while card bodies and
passive app work remain bounded. Native-only fit can zoom below the ordinary
DOM landscape floor. The same React Flow camera positions images, DOM labels,
clickable nodes and edges; the GPU plane cannot intercept input.

When a card is at least 120 CSS pixels wide, the existing four-touch/eight-desktop
runtime budget supplies nearby full-resolution originals. Selecting or
interacting with a case always uses its original adapter URL. Atlas loading
does not boot unnecessary background native runtimes or prevent explicit
interaction. Retained edits and content selections keep their original iframe
ancestors through filters, modes and playback. Demo continues in the original
running session and hides the overview through the existing presentation mode.

Missing GPU support, invalid metadata, checksum/decode failure, or context loss
falls back to the existing renderer with an explicit notice. No running frame
is reset to recover the accelerator. Context loss keeps this fallback until a
new atlas/rebuild; recovery does not silently restart user sessions.

Local atlas URLs and diagnostics are omitted from static exports. Publishing
source DOM does not authorize publishing private native capture assets. Static
native acceleration requires a future explicit publication contract; exported
original previews continue through the existing adapter.

## Regression evidence

`npm run test:native-overview` exercises original React input/state, actual
capture pixels, clickable cross-page edges, continuing Demo sessions, retained
frames, checksum failure, unavailable GPU and actual context loss. Running
`APP_CANVAS_TEST_NATIVE_ATLAS=1 npm run test:demo-controls` repeats the existing
rich playback controls with an active native overview. The ordinary viewer,
DOM, navigation, queues, exports, touch and installation gates remain required.

Performance qualification needs the real app catalog, original captures, a
fixed input digest, exact base/candidate revisions, browser/GPU identity and
viewport. Compare full visible coverage as well as timing, account for atlas
preparation, and distinguish JS heap, process RSS, decoded image bytes and GPU
resources. Small synthetic fixtures or native image measurements do not prove
arbitrary Web/React app performance or physical-device memory limits.

See the [integrated real-catalog experiment](native-overview-benchmark.md) for
the measured main/candidate results, pixel checks and regression boundaries.
