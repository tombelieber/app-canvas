# Product materials and locales

Agent Canvas publishes product, onboarding and release pages in eleven languages:
English, Traditional Chinese, Simplified Chinese, Japanese, Spanish, French,
German, Portuguese, Italian, Korean and Dutch. The viewer chrome supports the
same eleven languages. Changing generic viewer chrome does not translate a
user's application or relabel its original source content.

The bundled synthetic example has its own source-owned locale support. Its
initial supported example locales are **English (`en`) and Traditional Chinese
(`zh-TW`)**. A matching capture must show the real localized example, including
its embedded application, catalog labels, conditions and journey captions.
An English viewer surrounding a Chinese application is not an English capture.

## One content and asset contract

`launch/locales/*.json` contains marketing copy. `launch/content.mjs` reads the
package version and computes demo state/flow/queue counts from the actual
catalog and journeys. Installation commands and the agent prompt are shared.
Do not hard-code translated versions or counts.

`launch/demo-assets.mjs` owns the separate example locale/asset policy. The page
renderer, README generator and asset copier all consume this manifest:

| Marketing locale | Example opened | Screenshots and social images |
| --- | --- | --- |
| `en` | English | Actual English captures |
| `zh-TW` | Traditional Chinese | Actual Traditional Chinese captures |
| `zh-CN` | Traditional Chinese, explicitly labelled in Simplified Chinese | Omitted until actual matching Simplified Chinese captures exist |
| `ja`, `es`, `fr`, `de`, `pt`, `it`, `ko`, `nl` | English, explicitly labelled in the page's language | Omitted until actual matching captures exist |

There is no screenshot fallback across languages. Localized alt text does not
make another language's pixels appropriate. Unsupported image locales omit
`img`, `picture`, Open Graph/Twitter screenshot tags and schema image properties;
they keep the usable guide, visible demo-language badge and honest demo link.
`demoUrlForLocale` selects the actual example path and viewer language together.

Publishable captures live under `docs/screenshots/en/` and
`docs/screenshots/zh-TW/`. Each directory contains:

| Capture | Dimensions | Purpose |
| --- | --- | --- |
| `overview.jpg` | 1440 × 1000 | Whole application, guide, README and social image |
| `reference-desktop.png` | 1440 × 1000 | Real selected element, request and explicit copy handoff |
| `reference-phone.png` | 390 × 844 | The same handoff on the actual narrow viewport |
| `flow.jpg` | 1440 × 1000 | Real connected example flow |
| `playback.jpg` | 1440 × 1000 | Real authored failure/recovery playback |

The builder copies these bytes to `about/assets/screenshots/<locale>/` and fails
if a required capture is missing. Capture from the actual localized runtime;
never translate screenshots with overlays, DOM text replacement or image edits.
Review both visible language and data/privacy, and retain source revision,
fixture, state, viewport, example locale and capture provenance in evidence.

Historical captures such as `docs/stoolsense-iphone.png`, `docs/ui-delivery-*`
and `docs/review/**` retain their original bytes and meaning. They are not reused
as current localized marketing assets. A browser-emulated phone capture must
never replace a real physical iPhone witness while keeping that claim.

## Generate and verify

```sh
npm run docs:generate
npm run check:locales
npm test
npm run build:demo
npm run test:launch
```

The generator maintains the marked block in the English README and writes the
other ten READMEs. Keep the detailed English API reference outside that block.
Edit locale sources, not generated translations. `npm run check` rejects stale
files, missing or empty translations, shape differences and unknown facts.
Structural parity alone does not prove translated screenshots or app content.

`tests/launch.test.mjs` checks locale-specific image selection, omission and
explicit demo routing. The browser suite retains every locale/page/layout check,
decodes each offered image and verifies unsupported pages have no screenshot.
Runtime example tests separately prove the language inside the application.

## Public paths and compatibility

- Cloudflare product root: `https://agent-canvas-app.pages.dev/`.
- Cloudflare examples: `/demo/` is English; `/demo/zh-TW/` is Traditional Chinese.
- Existing GitHub Pages `/app-canvas/` remains the English interactive demo;
  `/app-canvas/zh-TW/` opens the Traditional Chinese example.
- Product docs keep `/about/`, locale segments such as `/about/zh-TW/`, and
  `start/` / `release/`. Language switching preserves the page type.
- Canonicals, reciprocal hreflang and public README links point to the canonical
  product site independently of the current asset-serving prefix.
- `llms.txt`, `llms-full.txt` and `about/launch.json` expose real integration
  instructions, source identity, current version and fixture counts.

`build:demo` preserves the root viewer, project metadata and exported app.
Installation uses the pinned GitHub source; it does not imply npm registry
publication. Product-material changes do not move existing version tags.

`lib/locales.mjs` is the marketing/viewer locale registry. Viewer strings live
in `ui/locales/`; `launch/cloud-locales.json` owns the localized legacy waitlist.
The pages use no remote fonts or client-side translation service. Explicit usage
events and privacy choices are described in [telemetry](telemetry.md).
