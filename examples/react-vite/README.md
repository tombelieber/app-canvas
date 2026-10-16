# React + Vite integration reference

This is a small runnable application, not a replacement UI for another app. Both
`src/main.jsx` and the preview import the exact same `src/App.jsx` and stylesheet.
In your own repository, keep your UI and adapt only `ui-review/` to its routes,
providers and data contracts. Do not copy these Tasks pages into your app.

```sh
npm install
npm install --save-dev github:tombelieber/app-canvas#v0.3.0
npx app-canvas browsers
npm run ui:review
npm run test:ui:review
```

The six cases cover both routes plus empty, loading, recoverable error and denied
states. The interaction gate saves a profile, navigates, adds a task, resets the
fixture and retries a failed request. No application backend is needed by the
preview. `npm run dev` is the ordinary app and expects its normal `/api` backend.

To review route changes, run from this example's root and inspect the diff:

```sh
node --input-type=module -e 'import {inventoryRoutes} from "@tombelieber/app-canvas/routes"; import {writeFile} from "node:fs/promises"; await writeFile("ui-review/routes.json", JSON.stringify(await inventoryRoutes("src/App.jsx"), null, 2)+"\n")'
```

The checked snapshot detects newly added routes; it does not discover every
conditional state. Add those to `catalog.json`, fixtures and the flow checks.
