import { serveStatic } from "./serve-static.mjs";
const app = await serveStatic(process.env.APP_CANVAS_STATIC_DIR || ".artifacts/site");
try {
  process.env.APP_CANVAS_TEST_URL = app.url;
  await import("./browser.mjs");
} finally { await app.close(); }
