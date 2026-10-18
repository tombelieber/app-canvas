import assert from "node:assert/strict";
import { chromium } from "./locale-browser.mjs";
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
  const manifest = app.getManifest();
  for (const id of Object.keys(manifest.screens)) {
    await page.getByLabel("搜尋畫面").fill(id);
    await page.locator(`button[title="${id}"]`).click();
    await page.frameLocator(`iframe[data-screen="${id}"]`).locator('html[data-review-ready="true"]').waitFor();
    assert.ok(await page.locator("iframe[data-screen]").count() <= 8, "all states must render actual code within a bounded resource budget");
  }
  console.log("PASS: all 77 cases render real application DOM on selection without screenshot images or simultaneous unbounded app instances.");
} finally { await browser.close(); await app.close(); }
