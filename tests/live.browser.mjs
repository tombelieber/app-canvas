import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startCanvas, packageRoot } from "../lib/server.mjs";
const app = await startCanvas({ root: packageRoot, configPath: "examples/stoolsense/canvas.config.mjs", port: 0, watchFiles: false });
const browser = await chromium.launch({ headless: true });
try {
  await app.firstBuild;
  const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
  await page.goto(app.address);
  await page.getByText("77 個畫面 · 已同步", { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll(".screen-frame").length === 77);
  assert.equal(await page.locator(".screen-frame img").count(), 0, "canvas must not display screenshots");
  assert.equal(await page.locator(".screen-frame iframe").count(), 77, "all states must mount real UI code, including zoomed-out overview");
  await page.locator('.review-workspace[data-live-ready="true"]').waitFor({ timeout: 45000 });
  await page.frameLocator('iframe[data-screen="capture-home"]').locator("#manual").waitFor();
  console.log("PASS: all 77 overview nodes render real application DOM without screenshot images.");
} finally { await browser.close(); await app.close(); }
