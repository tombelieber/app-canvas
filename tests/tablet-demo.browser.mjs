import assert from "node:assert/strict";
import { webkit } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { startCanvas, packageRoot } from "../lib/server.mjs";
const hosted = process.env.APP_CANVAS_TEST_URL;
const app = hosted ? { address: hosted, firstBuild: Promise.resolve(), close: async () => {} } : await startCanvas({ root: packageRoot, configPath: "examples/stoolsense/canvas.config.mjs", port: 0, watchFiles: false });
const browser = await webkit.launch();
try {
  await app.firstBuild;
  const page = await browser.newPage({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, timezoneId: "Asia/Hong_Kong" });
  page.setDefaultTimeout(15000);
  const errors = [], remote = []; let reloads = 0;
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if (!r.url().startsWith(app.address) && !r.url().startsWith("blob:")) remote.push(r.url()); });
  page.on("framenavigated", f => { if (f === page.mainFrame()) reloads++; });
  await page.goto(app.address);
  await page.getByText(`77 個畫面 · ${hosted ? "示範版本" : "已同步"}`, { exact: true }).waitFor();
  const ready = () => page.locator('.review-workspace[data-live-ready="true"][data-camera-ready="true"]').waitFor();
  await ready();
  for (let i = 0; i < 6; i++) {
    await page.getByLabel("頁面範圍").selectOption("all");
    await page.getByRole("button", { name: i % 2 ? "狀態圖" : "畫面總覽", exact: true }).tap();
    await ready();
    assert.equal(await page.locator('.screen-frame[data-visible="true"]').count(), 77);
    assert.ok(await page.locator("iframe").count() <= 4);
    await page.getByLabel("頁面範圍").selectOption(["capture", "history", "import"][i % 3]);
    await page.getByLabel("展開深度").selectOption("1"); await ready();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize(i % 2 ? { width: 820, height: 1180 } : { width: 1180, height: 820 });
  }
  await page.getByRole("button", { name: "頁面導航", exact: true }).tap();
  await page.getByLabel("頁面範圍").selectOption("capture"); await ready();
  await mkdir(".artifacts/tablet", { recursive: true });
  await page.screenshot({ path: ".artifacts/tablet/stoolsense-pages.png" });
  await page.getByLabel("播放流程").selectOption("__all__");
  await page.getByLabel("播放速度").selectOption("0");
  await page.getByRole("button", { name: "▶ 播放", exact: true }).tap();
  await page.waitForFunction(() => ["complete", "error"].includes(document.querySelector(".journey-panel")?.dataset.status), null, { timeout: 240000 });
  if (await page.locator(".journey-panel").getAttribute("data-status") === "error") {
    const preview = await page.frameLocator('iframe[data-screen="journey"]').locator("html").evaluate(el => ({ ready: el.dataset.reviewReady, error: el.dataset.reviewError, previewErrors: window.__review?.errors || window.__appCanvas?.errors || [], text: document.body.innerText.slice(-1600) })).catch(e => ({ inspectionError: e.message }));
    console.error("Synthetic demo failure:", JSON.stringify({ errors, preview }));
  }
  assert.equal(await page.locator(".journey-panel").getAttribute("data-status"), "complete", await page.locator(".journey-panel").innerText());
  assert.equal(await page.locator(".journey-panel").getAttribute("data-finished"), "121");
  await ready();
  assert.ok(await page.locator("iframe").count() <= 4);
  const frame = await page.locator(".journey-live").boundingBox(), area = await page.locator(".flow-stage").boundingBox();
  assert.ok(frame.x >= area.x && frame.x + frame.width <= area.x + area.width && frame.y >= area.y && frame.y + frame.height <= area.y + area.height + 2);
  assert.equal(reloads, 1, "switching views and scopes must not reload the host canvas");
  assert.deepEqual(errors, []); assert.deepEqual(remote, []);
  const proof = { engine: "WebKit", viewport: "iPad emulation, portrait/landscape", physicalDevice: false, cases: 77, played: 121, liveLimit: 4, hostNavigations: reloads, errors, remote };
  await writeFile(".artifacts/tablet/demo-proof.json", JSON.stringify(proof, null, 2));
  await page.screenshot({ path: ".artifacts/tablet/stoolsense-playback.png" });
  console.log("PASS:", JSON.stringify(proof));
} finally { await browser.close(); await app.close(); }
