import assert from "node:assert/strict";
import { chromium } from "playwright";
import { loadProject } from "../lib/config.mjs";
import { startCanvas, packageRoot } from "../lib/server.mjs";
import { verifyJourneys } from "../lib/verify.mjs";
import { caseCoverage } from "../lib/coverage.mjs";
const config = await loadProject("examples/stoolsense/canvas.config.mjs", packageRoot);
const app = await startCanvas({ config, root: packageRoot, port: 0, watchFiles: false });
const browser = await chromium.launch({ headless: true });
try {
  await app.firstBuild;
  const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, timezoneId: "Asia/Hong_Kong" });
  const errors = [], remote = [];
  page.on("pageerror", error=>errors.push(error.message));
  page.on("request", req=>{ if(!req.url().startsWith(app.address)&&!req.url().startsWith("blob:"))remote.push(req.url()); });
  await page.goto(app.address);
  await page.locator('.review-workspace[data-live-ready="true"]').waitFor({ timeout: 45000 });
  await page.getByRole("button", { name: "狀態圖", exact: true }).click();
  await page.locator('.review-workspace[data-view="machine"][data-camera-ready="true"]').waitFor();
  assert.equal(await page.locator('.screen-frame iframe').count(), 77);
  assert.equal(await page.locator('.screen-frame[data-outcome="failure"]').count() > 10, true);
  await verifyJourneys({ page, journeys: config.journeys, collectFailures: true, onResult: result=>console.log(`${result.passed ? "PASS" : "FAIL"}: ${result.id}${result.error ? ` ${result.error}` : ""}`) });
  assert.deepEqual(errors, []); assert.deepEqual(remote, []);
  console.log("Coverage:", JSON.stringify(caseCoverage(config)));
} finally { await browser.close(); await app.close(); }
