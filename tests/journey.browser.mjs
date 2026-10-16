import assert from "node:assert/strict";
import { chromium } from "playwright";
import { loadProject } from "../lib/config.mjs";
import { startCanvas, packageRoot } from "../lib/server.mjs";
const config = await loadProject("examples/stoolsense/canvas.config.mjs", packageRoot);
config.journeys.push({ id: "broken-proof", title: "Deliberate failed assertion", entry: "capture-home", steps: [{ title: "Must report the missing element", screen: "capture-manual", actions: [{ type: "expect", selector: "#deliberately-absent-control", timeout: 500 }] }] });
const app = await startCanvas({ config, root: packageRoot, port: 0, watchFiles: false });
const browser = await chromium.launch({ headless: true });
try {
 await app.firstBuild;
 const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
 await page.goto(app.address);
 await page.locator('.review-workspace[data-live-ready="true"]').waitFor({ timeout: 45000 });
 assert.equal(await page.getByLabel("播放流程").count(), 1);
 await page.getByLabel("播放速度").selectOption("0");
 for (const journey of config.journeys.slice(0, 3)) {
   await page.getByLabel("播放流程").selectOption(journey.id);
   await page.getByRole("button", { name: "▶ 播放", exact: true }).click();
   await page.waitForFunction(() => ["complete", "error"].includes(document.querySelector(".journey-panel")?.dataset.status), null, { timeout: 30000 });
   assert.equal(await page.locator(".journey-panel").getAttribute("data-status"), "complete", await page.locator(".journey-panel").innerText());
   assert.equal(await page.locator(".inspector code").innerText(), journey.steps.at(-1).screen);
   assert.equal(await page.locator('iframe[data-screen="journey"]').count(), 1);
   console.log(`PASS: ${journey.id} performed ${journey.steps.length} real UI steps and focused the terminal screen.`);
 }
 await page.getByLabel("播放流程").selectOption(config.journeys[0].id);
 await page.getByRole("button", { name: "單步", exact: true }).click();
 await page.locator('.journey-panel[data-status="paused"][data-step="1"]').waitFor();
 await page.getByRole("button", { name: "單步", exact: true }).click();
 await page.locator('.journey-panel[data-status="complete"]').waitFor();
 await page.getByRole("button", { name: "重播", exact: true }).click();
 await page.locator('.journey-panel[data-status="complete"]').waitFor();
 await page.getByLabel("播放流程").selectOption("broken-proof");
 await page.getByRole("button", { name: "▶ 播放", exact: true }).click();
 await page.locator('.journey-panel[data-status="error"]').waitFor();
 assert.match(await page.locator(".journey-panel").innerText(), /deliberately-absent-control/);
 assert.equal(await page.locator(".journey-panel").getAttribute("data-step"), "0");
 console.log("PASS: single-step, fresh replay and a red-capable failure that stops before claiming the target state.");
} finally { await browser.close(); await app.close(); }
