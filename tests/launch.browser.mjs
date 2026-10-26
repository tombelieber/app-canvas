import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "./locale-browser.mjs";
import { serveStatic } from "./serve-static.mjs";
import { loadContent, languages, pagePath, baseUrl } from "../launch/content.mjs";
import { demoAssetForLocale, demoLanguageBadge, demoLocaleForLocale } from "../launch/demo-assets.mjs";

const site = await serveStatic(process.env.APP_CANVAS_STATIC_DIR || ".artifacts/site", new URL(baseUrl).pathname);
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
        const supported = Boolean(demoAssetForLocale(locale, "overview"));
        const actualLocale = demoLocaleForLocale(locale);
        const images = page.locator("figure img");
        assert.equal(await images.count(), supported ? kind === "product" ? 2 : kind === "start" ? 1 : 3 : 0, `${engine} ${locale} ${kind} image policy`);
        for (const img of await images.all()) {
          await img.scrollIntoViewIfNeeded();
          await img.waitFor({ state: "visible" });
          await img.evaluate(element => element.decode());
          const image = await img.evaluate(element => ({ loaded: element.complete && element.naturalWidth > 0, url: element.currentSrc }));
          assert.ok(image.loaded, `${engine} ${locale} ${kind} image`);
          assert.ok(image.url.includes(`/screenshots/${locale}/`));
        }
        if (supported && kind === "product") {
          assert.ok((await page.locator(".journey-proof img").evaluate(img => img.currentSrc)).endsWith("/reference-phone.png"));
        }
        assert.equal(await page.locator('meta[property="og:image"]').count(), supported ? 1 : 0);
        assert.ok((await page.locator(".demo-language").innerText()).includes(demoLanguageBadge(locale)));
        const demoLink = new URL(await page.locator('[data-action="demo"]').first().getAttribute("href"));
        assert.equal(demoLink.searchParams.get("lang"), actualLocale);
        assert.equal(demoLink.pathname.endsWith("/zh-TW/"), actualLocale === "zh-TW");
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
