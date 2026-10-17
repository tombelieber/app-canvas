import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { startCanvas, packageRoot } from "../lib/server.mjs";

const app = await startCanvas({ root: packageRoot, configPath: "examples/stoolsense/canvas.config.mjs", port: 0, watchFiles: false });
try {
  await app.firstBuild;
  const sharedCases = Object.values(app.getManifest().screens).filter(s => s.sharedUrl).length;
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: process.env.APP_CANVAS_HEADED !== "1" });
    try {
      // Compare source pixels at rest. Camera animation has its own zoom gate;
      // a resize tween must not run between the two color comparison captures.
      const page = await browser.newPage({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, reducedMotion: "reduce" });
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
      assert.equal(await overview.locator('[data-preview="capture-home"] nav').evaluate(el => getComputedStyle(el).backdropFilter), "none", "thumbnail detail defers backdrop effects while retaining the full source UI");
      const checkAlignment = async () => {
        // ResizeObserver starts a camera animation after viewport resizing.
        // The old ready marker can still be true before that observer runs;
        // compare the two document contexts only once the actual camera settles.
        await page.waitForFunction(() => {
          const stage = document.querySelector('.flow-stage').getBoundingClientRect();
          const signature = `${stage.width},${stage.height},${document.querySelector('.react-flow__viewport').style.transform}`;
          const now = performance.now(), previous = globalThis.alignmentCamera;
          if (previous?.signature !== signature) { globalThis.alignmentCamera = { signature, since: now }; return false; }
          return now - previous.since >= 80 && document.querySelector('.review-workspace').dataset.cameraReady === 'true';
        });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await overview.locator("html").first().evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const frame = await page.locator('iframe[data-overview]').boundingBox();
        const surfaces = await page.locator('.react-flow__node-screen').evaluateAll(nodes => Object.fromEntries(nodes.map(node => {
          const rect = node.querySelector('.screen-surface').getBoundingClientRect();
          return [node.dataset.id, { x: rect.x, y: rect.y, width: rect.width, height: rect.height }];
        })));
        const previews = await overview.locator('[data-preview][data-visible="true"]').evaluateAll(nodes => nodes.map(node => {
          const rect = node.getBoundingClientRect();
          return { id: node.dataset.preview, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }));
        assert.ok(previews.length > 0, "alignment must exercise visible source UI");
        for (const preview of previews) {
          const expected = surfaces[preview.id];
          const errors = [preview.x + frame.x - expected.x, preview.y + frame.y - expected.y, preview.width - expected.width, preview.height - expected.height];
          assert.ok(errors.every(error => Math.abs(error) < .2), `${engine.name()} ${preview.id}: source UI must align with its selection/navigation surface: ${JSON.stringify(errors)}`);
        }
      };
      await checkAlignment();
      for (const viewport of [{ width: 1366, height: 1024 }, { width: 393, height: 852 }]) {
        await page.setViewportSize(viewport);
        await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
        await checkAlignment();
      }
      // Opaque source pixels must not be tinted by the canvas group behind them.
      await page.setViewportSize({ width: 1366, height: 1024 });
      await checkAlignment();
      const surface = await page.locator('[data-id="capture-home"] .screen-surface').boundingBox();
      const clip = { x: Math.ceil(surface.x + 2), y: Math.ceil(surface.y + 2), width: Math.floor(surface.width - 4), height: Math.floor(surface.height - 4) };
      // Headed mobile emulation can use different clipping coordinates after
      // resizing. Decode the same source area from the full page in both shots.
      const capture = async () => {
        const image = await page.screenshot({ fullPage: true });
        const pixels = await page.evaluate(async ({ png, clip }) => {
          const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
          const scale = image.width / document.documentElement.scrollWidth;
          const x = Math.round(clip.x * scale), y = Math.round(clip.y * scale);
          const width = Math.round(clip.width * scale), height = Math.round(clip.height * scale);
          if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > image.width || y + height > image.height) throw Error("Source comparison region is outside the full page");
          const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
          const context = canvas.getContext("2d"); context.drawImage(image, x, y, width, height, 0, 0, width, height);
          return [...context.getImageData(0, 0, width, height).data];
        }, { png: image.toString("base64"), clip });
        return { image, pixels: Buffer.from(pixels) };
      };
      const painted = await capture();
      const clearGroups = await page.addStyleTag({ content: '.board-group{background:transparent!important}' });
      const withoutGroups = await capture();
      if (!painted.pixels.equals(withoutGroups.pixels)) {
        await mkdir(".artifacts/shared-preview", { recursive: true });
        await writeFile(`.artifacts/shared-preview/${engine.name()}-before.png`, painted.image);
        await writeFile(`.artifacts/shared-preview/${engine.name()}-after.png`, withoutGroups.image);
      }
      assert.ok(painted.pixels.equals(withoutGroups.pixels), `${engine.name()}: group backgrounds must paint behind the source UI without tinting it`);
      await clearGroups.evaluate(el => el.remove());
      if (!await page.getByLabel("播放流程", { exact: true }).isVisible()) await page.getByRole("button", { name: "開啟流程控制", exact: true }).click();
      await page.getByLabel("播放流程", { exact: true }).selectOption("case-capture-home");
      await page.getByRole("button", { name: "▶ 播放", exact: true }).click();
      await page.locator('.journey-panel[data-status="complete"]').waitFor();
      await overview.locator('[data-preview="capture-home"][data-visible="false"]').waitFor({ state: "attached" });
      assert.equal(await page.locator('iframe[data-screen="journey"]').count(), 1, "the original running journey remains present above the canvas");
      console.log(`PASS ${engine.name()}: ${sharedCases} shared + ${77 - sharedCases} native full UI previews, ${contexts} browsing contexts total; source colors and journey visibility preserved.`);
    } finally { await browser.close(); }
  }
} finally { await app.close(); }
