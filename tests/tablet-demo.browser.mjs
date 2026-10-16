import assert from "node:assert/strict";
import { webkit } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { startCanvas, packageRoot } from "../lib/server.mjs";
const hosted = process.env.APP_CANVAS_TEST_URL;
const app = hosted ? { address: hosted, firstBuild: Promise.resolve(), close: async () => {} } : await startCanvas({ root: packageRoot, configPath: "examples/stoolsense/canvas.config.mjs", port: 0, watchFiles: false });
const browser = await webkit.launch();
try {
  await app.firstBuild;
  const bootManifest = hosted ? await (await fetch(new URL("manifest.json", hosted))).json() : app.getManifest();
  const fallbackCases = Object.entries(bootManifest.screens).filter(([, value]) => !value.domUrl).map(([id]) => id);
  assert.deepEqual(fallbackCases, [], "the DOM-compatible demo must keep all 77 full previews without starting fallback apps");
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, timezoneId: "Asia/Hong_Kong" });
  page.setDefaultTimeout(15000);
  const errors = [], remote = []; let reloads = 0;
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if (!r.url().startsWith(app.address) && !r.url().startsWith("blob:")) remote.push(r.url()); });
  page.on("framenavigated", f => { if (f === page.mainFrame()) reloads++; });
  await page.goto(app.address);
  await page.getByText(`77 個畫面 · ${hosted ? "示範版本" : "已同步"}`, { exact: true }).waitFor();
  const ready = async () => {
    try { await page.locator('.review-workspace[data-live-ready="true"][data-camera-ready="true"]').waitFor(); }
    catch (error) {
      console.error("Canvas readiness:", JSON.stringify(await page.locator(".review-workspace").evaluate(el => ({ state: {...el.dataset}, viewport: document.querySelector(".react-flow__viewport")?.getAttribute("style"), stage: document.querySelector(".flow-stage")?.getBoundingClientRect().toJSON(), live: [...document.querySelectorAll("iframe[data-screen]")].map(frame => ({ id: frame.dataset.screen, ready: frame.contentDocument?.documentElement.dataset.reviewReady, error: frame.contentDocument?.documentElement.dataset.reviewError })), documents: document.querySelectorAll("iframe[data-preview]").length }))));
      throw error;
    }
  };
  await ready();
  const initialStage = await page.locator(".flow-stage").boundingBox();
  assert.ok(initialStage.y <= 52 && initialStage.height >= 708, `landscape canvas gets the full height below one compact toolbar: ${JSON.stringify(initialStage)}`);
  assert.equal(await page.locator('.screen-frame[data-visible="true"]').count(), 77, "default overview shows all complete screens");
  assert.equal(await page.locator(".compact-state,.machine-caption,.preview-placeholder").count(), 0, "no metadata cards replace actual UI");
  const navigation = await page.locator(".layers-panel").boundingBox();
  const initialDetails = await page.locator(".details-panel").boundingBox();
  assert.ok(navigation.x === 0 && navigation.y <= 52 && initialDetails.x > initialStage.x && initialDetails.y <= 52, "landscape sidebars dock beside the full-height canvas");
  await page.getByRole("button", { name: "收起右側資料", exact: true }).tap(); await ready();
  assert.equal(await page.locator(".details-panel").count(), 0);
  assert.ok((await page.locator(".flow-stage").boundingBox()).width >= 1060, "hiding the right sidebar gives its width back to the canvas");
  await page.frameLocator('iframe[data-preview="capture-home"]').getByText("記低，然後繼續生活。", { exact: true }).first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('iframe[data-preview]')].every(el => el.dataset.ready === "true"));
  await mkdir(".artifacts/tablet", { recursive: true });
  await page.screenshot({ path: ".artifacts/tablet/landscape-overview.png" });
  for (let i = 0; i < 6; i++) {
    await page.getByLabel("頁面範圍").selectOption("all");
    await page.getByLabel("展開深度").selectOption("all");
    await page.getByRole("button", { name: i % 2 ? "狀態圖" : "畫面總覽", exact: true }).tap();
    await ready();
    assert.equal(await page.locator('.screen-frame[data-visible="true"]').count(), 77);
    assert.ok(await page.locator("iframe[data-screen]").count() <= 4);
    await page.getByLabel("頁面範圍").selectOption(["capture", "history", "import"][i % 3]);
    await page.getByLabel("展開深度").selectOption("1"); await ready();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize(i % 2 ? { width: 1280, height: 760 } : { width: 1180, height: 820 });
  }
  await page.getByRole("button", { name: "畫面總覽", exact: true }).tap();
  await page.getByLabel("頁面範圍").selectOption("capture"); await ready();
  await mkdir(".artifacts/tablet", { recursive: true });
  await page.screenshot({ path: ".artifacts/tablet/stoolsense-pages.png" });
  await page.getByRole("button", { name: "開啟流程控制", exact: true }).tap();
  const details = await page.locator(".details-panel").boundingBox();
  assert.ok(details.x > initialStage.x && details.y <= 52, "playback opens a docked right sidebar on landscape iPad");
  await page.locator('select[aria-label="播放流程"]').selectOption("__all__");
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
  assert.ok(await page.locator("iframe[data-screen]").count() <= 4);
  const frame = await page.locator(".journey-live").boundingBox(), area = await page.locator(".flow-stage").boundingBox();
  assert.ok(frame.x >= area.x && frame.x + frame.width <= area.x + area.width && frame.y >= area.y && frame.y + frame.height <= area.y + area.height + 2);
  assert.equal(reloads, 1, "switching views and scopes must not reload the host canvas");
  assert.deepEqual(errors, []); assert.deepEqual(remote, []);
  const proof = { engine: "WebKit", viewport: "iPad emulation, portrait/landscape", physicalDevice: false, cases: 77, played: 121, liveLimit: 4, hostNavigations: reloads, errors, remote };
  await writeFile(".artifacts/tablet/demo-proof.json", JSON.stringify(proof, null, 2));
  await page.screenshot({ path: ".artifacts/tablet/stoolsense-playback.png" });
  console.log("PASS:", JSON.stringify(proof));
} finally { await browser.close(); await app.close(); }
