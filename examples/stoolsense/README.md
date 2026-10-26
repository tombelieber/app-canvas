# StoolSense: real UI, synthetic data

This is a frozen, runnable export of an author-owned recording application's
actual frontend. It demonstrates 77 registered pages/states: capture and local
drafts, sync failures, result variants, symptom-reference levels, history,
comparisons, CSV/Excel import, exports, profiles and deletion confirmations.

Run `npm run demo` from the package root, or use `app-canvas demo` after install.
Double-click a frame to operate its real buttons, forms and navigation. Saves,
edits, imports and deletions affect only that disposable preview. The example
has no production API, credentials, private images, real health records or AI
requests. Any qualified-model appearance is an explicitly synthetic UI case.

All 77 named cases have independent playback with explicit DOM checks. There
are also 44 continuing interaction flows. Select all flows/cases to play the
whole set, or use the state graph to follow branches and expand real screens.
Dashed conditions and component references are distinct from performed
operations. Authentication fixtures display the actual shared login screen;
the demo does not perform or bypass sign-in. The complete-case and connected
graph guards are enabled, so new catalog states cannot silently be omitted.

`public/frame.js` is a bundled frontend export, not a second canvas engine.
`provenance.json` identifies the frontend revision and fixture count. The
original application maintains the UI source; this example is regenerated from
it rather than maintained as separate screen markup. The whole canvas comes
from the shared package, as it does for other project adapters.

## English and Traditional Chinese demos

`canvas.en.config.mjs` renders the English example; `canvas.config.mjs` retains
the original Traditional Chinese example. Both have the same 77 case IDs,
44 flows, 121 playable entries, original application controls and synthetic API.
The demo locale belongs to this example, independently of the canvas toolbar's
language. Other applications retain their own original language.

The English renderer is compiled from the already-public frozen `frame.js`,
shell and fixture metadata using the explicit dictionaries in `locales/`.
Translations replace cooked JavaScript literals/template segments before the
original code executes. They do not translate a rendered DOM, overlay labels,
replace controls or import a later private application revision. English CSV
fixtures and fixed journey expectations are generated alongside the renderer.
The original application's frozen revision was Traditional Chinese; the English
demo is a source-derived localized edition, not a claim that its production app
already supports English.

Regenerate or verify these reproducible outputs with:

```sh
node examples/stoolsense/build-locales.mjs
node examples/stoolsense/build-locales.mjs --check
```

`locales/en/provenance.json` records the original frontend commit, frozen-source,
dictionary and recipe hashes, and every generated output hash. Missing English
messages fail the compiler; no untranslated fallback is silently published.
