import original from "./canvas.config.mjs";
import example from "./locales/en/catalog.json";
import { createJourneys } from "./locales/en/journeys.mjs";
import { createStoolSensePreview } from "./preview.mjs";

// This opt-in demo locale does not translate third-party application content.
// Both languages use the same frozen original frontend and stable scenario IDs.
export default {
  ...original,
  ...example,
  journeys: createJourneys(example.catalog),
  preview: ({ root, canvasOrigin }) => createStoolSensePreview({ root, canvasOrigin, catalog: example.catalog, locale: "en" }),
};
