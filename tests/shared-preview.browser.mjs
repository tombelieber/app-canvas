import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { startCanvas, packageRoot } from "../lib/server.mjs";

const app = await startCanvas({ root: packageRoot, configPath: "examples/stoolsense/canvas.config.mjs", port: 0, watchFiles: false });
try {
  await app.firstBuild;
  const sharedCases = Object.values(app.getManifest().screens).filter(s => s.sharedUrl).length;
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: process.env.APP_CANVAS_HEADED !== "1" });
    try {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
      page.on("pageerror", error => console.error("PAGE:", error.message));
      page.on("console", message => { if (message.type() === "error") console.error("CONSOLE:", message.text()); });
      await page.goto(app.address);
      await page.locator('.review-workspace[data-live-ready="true"][data-camera-ready="true"]').waitFor();
      const contexts = page.frames().length - 1;
      assert.ok(contexts <= 5, `a cold phone overview must not create a browsing context per case: ${contexts} contexts for 77 cases`);
      const overview = page.frameLocator('iframe[data-overview]');
      try { await overview.locator('[data-preview][data-ready="true"]').nth(sharedCases - 1).waitFor({ state: "attached", timeout: 12000 }); }
      catch (error) { console.error("DIAGNOSTIC", await page.locator('iframe[data-overview]').evaluate(el => ({ ...el.dataset })), await overview.locator("body").innerText(), Object.values(app.getManifest().screens).filter(s => s.sharedUrl).length); throw error; }
      assert.equal(await overview.locator('[data-preview]').count(), sharedCases, "all compatible full real DOM previews remain present");
      assert.equal(sharedCases + await page.locator('iframe[data-preview]').count(), 77, "native top-layer documents keep their own renderer; no case disappears");
      await overview.locator('[data-preview="capture-home"]').getByText("記低，然後繼續生活。", { exact: true }).first().waitFor();
      assert.equal(await overview.locator("html").first().evaluate(() => { try { return !!parent.document; } catch { return false; } }), false, "the shared renderer retains an opaque sandbox");
      assert.equal(await overview.locator("iframe,canvas,img[data-screenshot]").count(), 0, "source DOM is rendered without nested contexts or screenshots");
      console.log(`PASS ${engine.name()}: ${sharedCases} shared + ${77 - sharedCases} native full UI previews, ${contexts} browsing contexts total.`);
    } finally { await browser.close(); }
  }
} finally { await app.close(); }
