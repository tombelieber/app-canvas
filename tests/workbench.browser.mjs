import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { mkdir } from "node:fs/promises";
import { startCanvas } from "../lib/server.mjs";
const config = {
  title: "Tablet workbench", groups: [{ id: "app", title: "Application" }],
  pages: [{ id: "home", title: "Home", route: "/" }, { id: "settings", title: "Settings", route: "/settings" }],
  catalog: Array.from({ length: 30 }, (_, i) => ({ id: `case-${i}`, title: `State ${i}`, group: "app", pageId: i < 15 ? "home" : "settings", feature: i % 3 === 0 ? "Record" : i % 3 === 1 ? "Import" : "Review" })),
  flows: [{ from: "case-0", to: "case-20", label: "Open settings" }],
  journeys: [{ id: "save", title: "Save a draft", entry: "case-0", steps: [{ screen: "case-0", title: "Save", actions: [{ type: "fill", selector: "input", value: "played" }, { type: "click", selector: "button" }, { type: "expect", selector: "output", text: "played" }] }] }],
  preview: async ({ canvasOrigin }) => ({ url: s => `${canvasOrigin}/frame?id=${s.id}`, handle(req, res, url) {
    if (url.pathname !== "/frame") return false;
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><html data-review-ready="true"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>Live app</h1><input aria-label="Draft"><button onclick="document.querySelector(\'output\').textContent=document.querySelector(\'input\').value">Save</button><output>Initial</output></body></html>'); return true;
  } }),
};
const app = await startCanvas({ config, port: 0, watchFiles: false });
const engine = process.env.APP_CANVAS_ENGINE || "chromium";
const reloadOnResize = engine === "webkit" && process.platform === "linux" && process.env.APP_CANVAS_HEADED === "1";
const browser = await ({ chromium, webkit })[engine].launch({ headless: process.env.APP_CANVAS_HEADED !== "1" });
try {
  await app.firstBuild;
  const context = await browser.newContext({ viewport: { width: 1280, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(app.address);
  await page.getByText("30 個畫面 · 已同步", { exact: true }).waitFor();
  await page.locator('.review-workspace[data-live-ready="true"]').waitFor();
  assert.ok(await page.locator("iframe[data-screen]").count() <= 4, "touch overview must bound live app instances, including hidden cases");
  await page.getByLabel("頁面範圍").selectOption("home");
  assert.equal(await page.locator('.screen-frame[data-visible="true"]').count(), 15, "default depth shows complete states");
  await page.getByLabel("展開深度").selectOption("1");
  assert.equal(await page.locator('.screen-frame[data-visible="true"]').count(), 3, "optional depth limits which full screens are shown");
  await page.getByLabel("展開深度").selectOption("all");
  assert.equal(await page.locator('.screen-frame[data-visible="true"]').count(), 15);
  await page.getByLabel("搜尋畫面").fill("case-0");
  if (await page.getByRole("button", { name: "導航", exact: true }).isVisible()) await page.getByRole("button", { name: "導航", exact: true }).tap();
  await page.locator('button[title="case-0"]').tap();
  const settled = () => page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
  await settled();
  await page.frameLocator('iframe[data-screen="case-0"]').getByRole("button", { name: "Save", exact: true }).waitFor();
  const saveBounds = await page.frameLocator('iframe[data-screen="case-0"]').getByRole("button", { name: "Save", exact: true }).boundingBox();
  await page.touchscreen.tap(saveBounds.x + saveBounds.width / 2, saveBounds.y + saveBounds.height / 2);
  assert.equal(await page.frameLocator('iframe[data-screen="case-0"]').locator("output").innerText(), "Initial", "Browse prevents accidental app actions through the canvas");
  if (engine === "chromium") {
    const session = await context.newCDPSession(page), stage = await page.locator(".flow-stage").boundingBox();
    const x = stage.x + stage.width / 2, y = stage.y + stage.height / 2;
    const before = await page.locator(".react-flow__viewport").getAttribute("style");
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 80, y: y + 40, id: 1 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await settled();
    assert.notEqual(await page.locator(".react-flow__viewport").getAttribute("style"), before, "one-finger touch pans the canvas");
    assert.equal(await page.locator(".inspector code").innerText(), "case-0", "dragging does not activate another node or clear the selection");
    const zoomBefore = await page.locator(".zoom-label").innerText();
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x - 40, y, id: 1 }, { x: x + 40, y, id: 2 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 90, y, id: 1 }, { x: x + 90, y, id: 2 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await settled();
    assert.ok(parseInt(await page.locator(".zoom-label").innerText()) > parseInt(zoomBefore), "two-finger pinch zooms the canvas");
    await page.getByRole("button", { name: "放大至畫面", exact: false }).tap(); await settled();
  }
  await page.getByRole("button", { name: "Interact", exact: true }).tap();
  const frame = page.frameLocator('iframe[data-screen="case-0"]');
  await frame.getByLabel("Draft").fill("unsaved memory-only draft");
  await page.getByRole("button", { name: "Browse", exact: true }).tap();
  assert.equal(await page.locator('iframe[data-screen="case-0"]').evaluate(el => getComputedStyle(el).pointerEvents), "none");
  await page.locator(".inspector .flow-link").tap();
  await settled();
  assert.equal(await page.locator(".inspector code").innerText(), "case-20", "cross-page links reveal and focus the destination");
  assert.equal(await page.getByLabel("頁面範圍").inputValue(), "settings");
  const bounds = await page.locator('[data-id="case-20"] .screen-frame').boundingBox(), stage = await page.locator(".flow-stage").boundingBox();
  assert.ok(bounds.x >= stage.x && bounds.x + bounds.width <= stage.x + stage.width && bounds.y >= stage.y);
  await page.getByLabel("搜尋畫面").fill("case-0");
  if (await page.getByRole("button", { name: "導航", exact: true }).isVisible()) await page.getByRole("button", { name: "導航", exact: true }).tap();
  await page.locator('button[title="case-0"]').tap();
  await settled();
  assert.equal(await frame.getByLabel("Draft").inputValue(), "unsaved memory-only draft", "edited frame remains mounted across scope changes");
  for (const id of ["case-1", "case-2", "case-3"]) {
    await page.getByLabel("搜尋畫面").fill(id);
    if (await page.getByRole("button", { name: "導航", exact: true }).isVisible()) await page.getByRole("button", { name: "導航", exact: true }).tap();
    await page.locator(`button[title="${id}"]`).tap(); await settled();
    await page.getByRole("button", { name: "Interact", exact: true }).tap();
    await page.getByRole("button", { name: "Browse", exact: true }).tap();
  }
  await page.getByRole("alert").filter({ hasText: "請喺「面板」釋放" }).waitFor();
  assert.equal(await frame.getByLabel("Draft").inputValue(), "unsaved memory-only draft", "budget exhaustion never silently evicts an edited frame");
  assert.ok(await page.locator("iframe[data-screen]").count() <= 4);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "釋放 · State 2", exact: true }).tap();
  await page.getByRole("button", { name: "面板", exact: true }).tap();
  await page.getByRole("button", { name: "面板", exact: true }).tap();
  for (const name of ["頂部工具列", "左側導航", "右側資料"]) await page.getByLabel(name, { exact: true }).uncheck();
  await page.getByRole("button", { name: "面板", exact: true }).tap();
  assert.equal(await page.locator(".workspace-bar").count(), 0);
  assert.equal(await page.locator(".layers-panel").count(), 0);
  assert.equal(await page.locator(".inspector").count(), 0);
  await page.reload();
  await page.locator('.review-workspace[data-live-ready="true"]').waitFor();
  assert.equal(await page.locator(".workspace-bar").count(), 0, "panel preference survives reload");
  await page.getByRole("button", { name: "面板", exact: true }).tap();
  await page.getByRole("button", { name: "還原版面", exact: true }).tap();
  for (const viewport of [{ width: 1180, height: 820 }, { width: 736, height: 908 }, { width: 320, height: 800 }]) {
    await page.setViewportSize(viewport);
    // GTK mobile emulation retains its initial layout viewport until reload;
    // native macOS/headless and Chromium still exercise in-place resizing.
    if (reloadOnResize) await page.reload();
    await settled();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), true, `host stays within ${viewport.width}px viewport`);
    const b = await page.getByRole("button", { name: "Browse", exact: true }).boundingBox();
    assert.ok(b.width >= 44 && b.height >= 44, "mode switch is a reachable touch target");
  }
  await page.setViewportSize({ width: 1280, height: 760 });
  if (reloadOnResize) await page.reload();
  if (!await page.locator('select[aria-label="播放流程"]').isVisible()) await page.getByRole("button", { name: "開啟流程控制", exact: true }).click();
  await page.locator('select[aria-label="播放流程"]').selectOption("save");
  await page.getByRole("button", { name: "▶ 播放", exact: true }).tap();
  await page.locator('.journey-panel[data-status="complete"]').waitFor();
  assert.ok(await page.locator("iframe[data-screen]").count() <= 4, "playback shares the touch live-frame budget");
  assert.deepEqual(errors, []);
  await mkdir(".artifacts/tablet", { recursive: true });
  await page.screenshot({ path: `.artifacts/tablet/${engine}.png` });
  console.log(`PASS ${engine}: bounded previews, page/depth filters, touch modes, in-memory drafts, cross-page camera, panels/persistence, portrait/landscape/split view and flow playback.`);
} finally { await browser.close(); await app.close(); }
