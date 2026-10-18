import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { serveStatic } from "./serve-static.mjs";
import { loadContent, languages, pagePath } from "../launch/content.mjs";

const site = await serveStatic(process.env.APP_CANVAS_STATIC_DIR || ".artifacts/site", "/app-canvas/");
const origin = new URL(site.url).origin;
const { locales, facts } = await loadContent();
const results = [];
await mkdir(".artifacts/launch", { recursive: true });
try {
  for (const [engine, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
    const browser = await browserType.launch();
    try {
      const page = await browser.newPage();
      for (const locale of languages) for (const kind of ["product", "start", "release"]) {
        await page.setViewportSize({ width: 390, height: 844 });
        const response = await page.goto(`${origin}${pagePath(locale, kind)}`);
        assert.equal(response.status(), 200);
        await page.locator("figure img").first().scrollIntoViewIfNeeded();
        await page.locator("figure img").first().waitFor({ state: "visible" });
        await page.locator("figure img").first().evaluate(img => img.decode());
        const image = await page.locator("figure img").first().evaluate(img => ({ loaded: img.complete && img.naturalWidth > 0 }));
        assert.ok(image.loaded, `${engine} ${locale} ${kind} image`);
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        assert.ok(await page.locator(".summary").innerText());
        assert.equal(await page.locator('link[hreflang="x-default"]').count(), 1);
        if (kind !== "product") assert.ok((await page.locator("main").innerText()).includes(`github:tombelieber/app-canvas#v${facts.version}`));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${engine} ${locale} ${kind} overflow`);
        results.push({ engine, locale, kind, width: 390, status: "pass" });
      }
      for (const width of [1024, 1366]) {
        await page.setViewportSize({ width, height: 768 });
        await page.goto(`${origin}${pagePath("en", "start")}`);
        await page.locator(".languages summary").click();
        await page.locator(".languages").getByRole("link", { name: locales["zh-TW"].name, exact: true }).click();
        assert.equal(new URL(page.url()).pathname, pagePath("zh-TW", "start"));
        assert.equal(await page.locator(".steps>li").count(), 5);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: `.artifacts/launch/${engine}-${width}.png`, fullPage: true });
        results.push({ engine, width, languageSwitch: "preserves quickstart", status: "pass" });
      }
    } finally { await browser.close(); }
  }
  await writeFile(".artifacts/launch/browser-results.json", JSON.stringify(results, null, 2));
  console.log(`${results.length} launch page/layout/language checks passed`);
} finally { await site.close(); }
