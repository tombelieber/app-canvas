import { serveStatic } from "./serve-static.mjs";
import { join } from "node:path";
// Preserve the original complete Chinese interaction suite. The new English
// default is additionally qualified by test:demo-locales.
const app = await serveStatic(join(process.env.APP_CANVAS_STATIC_DIR || ".artifacts/site", "zh-TW"));
try {
  process.env.APP_CANVAS_TEST_URL = app.url;
  await import("./browser.mjs");
} finally { await app.close(); }
