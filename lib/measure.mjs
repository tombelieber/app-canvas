import { localOrigin } from "./protocol.mjs";
import { captureDocument } from "./dom-preview.mjs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
export async function measureScreen({ browser, project, scenario, preview, address, output }) {
  const viewport = scenario.viewport || project.viewport || { width: 390, height: 844 };
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, timezoneId: project.timezone || "Asia/Hong_Kong", reducedMotion: "reduce", serviceWorkers: "block" });
  const url = preview.url(scenario), origin = localOrigin(url), errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => [address, origin].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort("blockedbyclient"));
  try {
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(() => document.documentElement.dataset.reviewReady, null, { timeout: project.timeout || 20000 });
    const result = await page.evaluate(() => ({
      error: document.documentElement.dataset.reviewError,
      errors: window.__review?.errors || window.__appCanvas?.errors || [],
      unmocked: window.__appCanvas?.requests || [],
      height: document.documentElement.scrollHeight + Math.max(0, ...[...document.querySelectorAll("main,[role=main],[data-canvas-scroll]")].filter((el) => el.clientHeight > 0).map((el) => Math.max(0, el.scrollHeight - el.clientHeight))),
    }));
    if (result.error || errors.length || result.errors.length || result.unmocked.length)
      throw Error(result.error || [...errors, ...result.errors, ...result.unmocked.map((r) => `Unmocked ${r.method} ${r.path}`)].join("; "));
    let domUrl;
    if (output) {
      // Unsupported drawing surfaces or resources retain their original live
      // renderer. A failed optimization must not break an existing preview.
      let timer;
      const html = await Promise.race([
        captureDocument({ page, allowedOrigins: [address, origin] }),
        new Promise(resolve => { timer = setTimeout(() => resolve(null), 8000); }),
      ]).catch(() => null).finally(() => clearTimeout(timer));
      if (html) { await writeFile(join(output, `dom-${scenario.id}.html`), html); domUrl = `${address}/assets/dom-${scenario.id}.html`; }
    }
    await scenario.verify?.(page);
    return { width: viewport.width, height: Math.max(viewport.height, Math.min(16000, result.height)), url, domUrl };
  } catch (error) {
    console.error(`${scenario.id}: ${error.message}`);
    return { ...viewport, url, error: error.message };
  } finally { await page.close(); }
}
