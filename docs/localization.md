# Product materials and locales

App Canvas publishes the product page, repository onboarding guide and release
story in English, Traditional Chinese, Simplified Chinese, Japanese, Spanish,
French, German, Portuguese, Italian, Korean and Dutch. The viewer controls
remain Traditional Chinese. Project labels may use any language.

## One content contract

`launch/locales/*.json` contains the localized copy. `launch/content.mjs` reads
the package version and computes demo state/flow/queue counts from the actual
catalog and journeys. Installation commands and the agent prompt are shared.
Do not hard-code a translated version or count.

```sh
npm run docs:generate
npm run check:locales
npm test
npm run build:demo
npm run test:launch
```

The generator maintains language links in the English README and writes the
other ten README files. Keep the detailed English API reference outside the
generated marker. Edit locale sources, not generated translations.
`npm run check` rejects stale files, missing or empty translations, shape
differences and unknown fact placeholders. This verifies structural parity;
language review for tone and meaning remains useful.

## Public paths and compatibility

- `/app-canvas/` remains the interactive demo.
- `/app-canvas/about/` is the English product page. Other languages add a
  segment, such as `/app-canvas/about/zh-TW/`.
- Each locale has `start/` and `release/` pages. Language switching keeps the
  page type. Canonical URLs, reciprocal hreflang, social metadata and
  structured data are generated for each page.
- `llms.txt` points agents at the versioned integration guide. `llms-full.txt`
  contains the guide and source identity. `about/launch.json` records the
  material version and fixture counts.

`build:demo` adds static pages after the normal export. It does not replace
the root viewer, project metadata or exported app. Installation uses the
existing GitHub source; this does not imply npm registry publication.
Product-material updates alone do not require moving a version tag.

Use publishable real captures under `docs/`. The overview and flow show the
synthetic public web demo; the iPhone image is a real Safari capture. Never
include private data, device identifiers, profiles, raw traces or credentials.
Review image pixels as well as text privacy checks. The pages require no new
analytics, remote fonts or client-side translation service.
