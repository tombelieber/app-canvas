import assert from "node:assert/strict";
import { webkit } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { startCanvas, packageRoot } from "../lib/server.mjs";

const hosted = process.env.APP_CANVAS_TEST_URL;
const app = hosted ? { address: hosted, firstBuild: Promise.resolve(), close: async () => {} } : await startCanvas({ root: packageRoot, configPath: "examples/stoolsense/canvas.config.mjs", port: 0, watchFiles: false });
const browser = await webkit.launch({ headless: process.env.APP_CANVAS_HEADED !== "1" });
const proof = { engine: "WebKit", physicalDevice: false, input: "DOM touch events through the canvas gesture handler", samples: 0, cycles: 0, maxOffscreen: 0, errors: [] };
try {
  await app.firstBuild;
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  page.on("crash", () => proof.errors.push("page-crashed"));
  page.on("pageerror", error => proof.errors.push(error.message));
  let navigations = 0;
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigations++; });
  await page.goto(app.address);
  await page.locator('.review-workspace[data-live-ready="true"][data-camera-ready="true"]').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('iframe[data-preview]').length === 77 && [...document.querySelectorAll('iframe[data-preview]')].every(frame => frame.dataset.ready === "true"));
  assert.equal(await page.locator(".compact-state,.machine-caption,.preview-placeholder").count(), 0);
  const stage = await page.locator(".flow-stage").boundingBox();
  const center = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 };
  // WebKit does not expose a constructible Touch on every supported host.
  // Send the same touch coordinates to d3's real touch listener; do not set
  // canvas state or transforms directly. Native-device gestures stay separate.
  const touch = (type, span) => page.evaluate(({ type, span, center }) => {
    const target = document.querySelector(".react-flow__pane");
    const touches = [-1, 1].map((direction, index) => ({ identifier: index + 1, target, clientX: center.x + direction * span, clientY: center.y, pageX: center.x + direction * span, pageY: center.y, screenX: center.x + direction * span, screenY: center.y }));
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, { touches: { value: type === "touchend" ? [] : touches }, targetTouches: { value: type === "touchend" ? [] : touches }, changedTouches: { value: touches } });
    target.dispatchEvent(event);
  }, { type, span, center });
  const sample = async () => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const result = await page.evaluate(() => {
      const stage = document.querySelector(".flow-stage").getBoundingClientRect();
      const frames = [...document.querySelectorAll("iframe[data-preview]")];
      return { count: frames.length, offscreen: frames.filter(frame => { const rect = frame.getBoundingClientRect(); return rect.right <= stage.left || rect.left >= stage.right || rect.bottom <= stage.top || rect.top >= stage.bottom; }).length, moving: document.querySelector(".review-workspace").dataset.cameraReady === "false" };
    });
    proof.samples++; proof.maxOffscreen = Math.max(proof.maxOffscreen, result.offscreen);
    assert.equal(result.offscreen, 0, `release offscreen preview documents during the gesture, before touchend: ${JSON.stringify(result)}`);
  };
  const pinch = async reverse => {
    await touch("touchstart", reverse ? 150 : 10);
    for (let step = 1; step <= 10; step++) {
      await touch("touchmove", reverse ? 150 - step * 14 : 10 + step * 14);
      await sample();
    }
    await touch("touchend", reverse ? 10 : 150);
    await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
  };
  const initialZoom = await page.locator(".zoom-label").innerText();
  for (let cycle = 0; cycle < 20; cycle++) {
    await pinch(false);
    assert.notEqual(await page.locator(".zoom-label").innerText(), initialZoom, "touch coordinates must actually zoom the canvas");
    if (cycle % 5 === 0) {
      await pinch(false);
      assert.equal(await page.locator(".zoom-label").innerText(), "500%", "exercise the maximum canvas zoom");
      await pinch(true);
    }
    await pinch(true);
    assert.equal(await page.locator(".screen-frame[data-visible=true]").count(), 77, "zooming must not remove named cases");
    await page.waitForFunction(() => document.querySelectorAll("iframe[data-preview]").length === 77);
    proof.cycles++;
  }
  assert.equal(navigations, 1, "repeated zoom never reloads the host");
  assert.deepEqual(proof.errors, []);
  await mkdir(".artifacts/zoom", { recursive: true });
  await writeFile(".artifacts/zoom/proof.json", JSON.stringify({ ...proof, navigations }, null, 2));
  console.log("PASS:", JSON.stringify({ ...proof, navigations }));
} finally { await browser.close(); await app.close(); }
