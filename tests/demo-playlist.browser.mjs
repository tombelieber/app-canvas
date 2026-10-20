import assert from "node:assert/strict";
import { chromium } from "./locale-browser.mjs";
import { startCanvas, packageRoot } from "../lib/server.mjs";

// Exercise the actual audience entry point against the complete public app,
// in addition to the small fixtures that isolate player-control behavior.
const app = await startCanvas({ root: packageRoot, configPath: "examples/stoolsense/canvas.config.mjs", port: 0, watchFiles: false });
const browser = await chromium.launch({ headless: true });
try {
  await app.firstBuild;
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, hasTouch: true, isMobile: true });
  const errors = [], remote = []; let navigations = 0;
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (!request.url().startsWith(app.address) && !request.url().startsWith("blob:")) remote.push(request.url()); });
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigations++; });
  await page.goto(app.address);
  await page.locator('.review-workspace[data-live-ready="true"][data-camera-ready="true"]').waitFor();
  await page.getByRole("button", { name: "自動播放 Demo", exact: true }).tap();
  const player = page.getByRole("region", { name: "Demo 播放" });
  await player.getByLabel("Demo 播放速度").selectOption("0");
  await page.waitForFunction(() => ["complete", "error"].includes(document.querySelector(".demo-player")?.dataset.status), null, { timeout: 484000 });
  assert.equal(await player.getAttribute("data-status"), "complete", await player.innerText());
  assert.equal(await player.getByLabel("Demo 播放範圍").inputValue(), "__all__");
  assert.equal(await player.getAttribute("data-finished"), "121", "one-click Demo completes all 44 flows and 77 standalone cases");
  assert.equal(await player.getAttribute("data-skipped"), "0");
  assert.equal(await player.getByRole("progressbar").getAttribute("aria-valuenow"), "100");
  await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
  const frame = await page.locator(".journey-live").boundingBox(), area = await page.locator(".flow-stage").boundingBox();
  assert.ok(frame.x >= area.x - 1 && frame.x + frame.width <= area.x + area.width + 1 && frame.y >= area.y - 1 && frame.y + frame.height <= area.y + area.height + 2, "the complete live app stays visible above the player");
  assert.ok(await page.locator("iframe[data-screen]").count() <= 4);
  await player.getByRole("button", { name: "退出 Demo", exact: true }).tap();
  assert.equal(await page.getByLabel("播放流程").inputValue(), "");
  assert.equal(navigations, 1, "the audience playlist never reloads its host");
  assert.deepEqual(errors, []); assert.deepEqual(remote, []);
  console.log("PASS Chromium touch: one-click audience playlist completed 121/121 real demos, zero skips/errors/remote requests, bounded live frames and restored browsing.");
} finally { await browser.close(); await app.close(); }
