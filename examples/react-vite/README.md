# React + Vite integration reference

This is a small runnable application, not a replacement UI for another app. Both
`src/main.jsx` and the preview import the exact same `src/App.jsx` and stylesheet.
In your own repository, keep your UI and adapt only `ui-review/` to its routes,
providers and data contracts. Do not copy these Tasks pages into your app.

```sh
npm install
npm install --save-dev github:tombelieber/app-canvas#v0.13.0
npx app-canvas browsers
npm run ui:review
npm run test:ui:review
```

The eight cases cover both routes plus empty, loading, recoverable error, denied, pending profile and saved
states. The interaction gate saves a profile, navigates, adds a task, resets the
fixture and retries a failed request. No application backend is needed by the
preview. `npm run dev` is the ordinary app and expects its normal `/api` backend.

To review route changes, run from this example's root and inspect the diff:

```sh
node --input-type=module -e 'import {inventoryRoutes} from "@tombelieber/app-canvas/routes"; import {writeFile} from "node:fs/promises"; await writeFile("ui-review/routes.json", JSON.stringify(await inventoryRoutes("src/App.jsx"), null, 2)+"\n")'
```

The checked snapshot detects newly added routes; it does not discover every
conditional state. Add those to `catalog.json`, fixtures and the flow checks.


For the development UI-delivery workflow, install the verified revision that
contains these commands (the v0.12.0 release predates them), then run:

```sh
npx app-canvas populate --config ui-review/delivery.config.mjs --verify
# Remove --verify to keep the verified viewer open. Repeat to resume.
```

`prepare.mjs` records the explicit source review for this small example;
`delivery.config.mjs` checks all eight original states and performs real
navigation/add/retry/save actions. It does not generate UI markup. The final
UI gate runs again even when preparation artifacts are reused. The unchanged
`--complete` still fails without its separate full source-audit inventory.
