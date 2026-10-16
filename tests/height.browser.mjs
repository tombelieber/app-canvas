import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startCanvas } from "../lib/server.mjs";
const app = await startCanvas({ port: 0, watchFiles: false, config: {
  title: "Viewport-dependent layout", groups: [{ id: "app", title: "Pages" }],
  catalog: [{ id: "home", title: "Home", group: "app" }],
  preview: async ({ canvasOrigin }) => ({ url: () => `${canvasOrigin}/frame`, handle(req, res, url) {
    if (url.pathname !== "/frame") return false;
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><html data-review-ready="true"><head><style>body{margin:0}main{height:calc(100vh - 100px);overflow:auto}main>div{min-height:calc(100vh - 60px)}</style></head><body><main><div>Viewport-dependent app content</div></main></body></html>'); return true;
  } }),
} });
const browser = await chromium.launch();
try {
  await app.firstBuild;
  const measured = app.getManifest().screens.home.height;
  const page = await browser.newPage(); await page.goto(app.address);
  await page.getByRole("button", {name:"畫面總覽",exact:true}).click();
  await page.locator('.review-workspace[data-live-ready="true"]').waitFor();
  await page.evaluate(() => new Promise((resolve) => { let count = 0; const frame = () => ++count === 12 ? resolve() : requestAnimationFrame(frame); requestAnimationFrame(frame); }));
  assert.equal(await page.locator('iframe[data-screen="home"]').evaluate((el) => parseFloat(el.style.height)), measured, "live resize observations must not feed a vh/scroll-area height growth loop");
  console.log("PASS: viewport-dependent scroll layout keeps a bounded measured overview height.");
} finally { await browser.close(); await app.close(); }
