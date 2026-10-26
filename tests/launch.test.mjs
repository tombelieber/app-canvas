import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { loadContent, validateLocales, languages, pageUrl, publicPageUrl, publicDemoUrl, demoUrlForLocale, commands } from "../launch/content.mjs";
import { demoAssetForLocale, demoAssetCopies, demoLanguageBadge, demoLocaleForLocale } from "../launch/demo-assets.mjs";
import { renderPage } from "../launch/pages.mjs";
import { buildLaunch } from "../scripts/build-launch.mjs";
import { translatedReadme, syncReadmes } from "../launch/readmes.mjs";

test("all launch locales share facts, commands, navigation and coverage boundaries", async () => {
  const content = await loadContent(), { facts, locales } = content;
  assert.equal(languages.length, 11);
  assert.equal(facts.entries, facts.states + facts.flows);
  await syncReadmes(content, true);
  for (const locale of languages) {
    const readme = translatedReadme(locale, content);
    assert.ok(readme.includes(commands(facts).install));
    assert.ok(readme.includes("populate --config ui-review/canvas.config.mjs --source-root . --verify"));
    for (const page of ["product", "start", "release"]) {
      const html = renderPage(locale, page, content);
      assert.ok(html.includes(`<html lang="${locale}">`));
      assert.ok(html.includes(`rel="canonical" href="${publicPageUrl(locale, page)}"`));
      assert.equal((html.match(/rel="alternate" hreflang=/g) || []).length, 12);
      assert.ok(!/\{(?:states|flows|entries|version)\}/.test(html));
      assert.ok(html.includes(locales[locale].limits[2]));
      if (page !== "product") assert.ok(html.includes("populate --config ui-review/canvas.config.mjs --source-root . --verify"));
    }
  }
});

test("translation omissions and invented facts fail closed", async () => {
  const { locales, facts } = await loadContent();
  const missing = structuredClone(locales); delete missing.ja.limits;
  assert.throws(() => validateLocales(missing, facts), /schema mismatch: ja/);
  const unknown = structuredClone(locales); unknown.fr.title += " {unsupported}";
  assert.throws(() => validateLocales(unknown, facts), /Unknown fact unsupported/);
});

test("marketing pixels and social images only use actual matching example locales", async () => {
  const content = await loadContent();
  for (const locale of languages) {
    const actualLocale = demoLocaleForLocale(locale);
    const supported = ["en", "zh-TW"].includes(locale);
    for (const page of ["product", "start", "release"]) {
      const html = renderPage(locale, page, content);
      assert.ok(html.includes(`data-demo-locale="${actualLocale}"`));
      assert.ok(html.includes(demoLanguageBadge(locale)));
      assert.ok(html.includes(`href="${demoUrlForLocale(locale)}"`));
      assert.ok(!/stoolsense-|assets\/(?:overview|reference|flow|playback|iphone)\./.test(html));
      const structured = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
      if (supported) {
        assert.ok(html.includes(`assets/screenshots/${locale}/overview.jpg`));
        assert.ok(html.includes(`property="og:image" content="https://agent-canvas-app.pages.dev/about/assets/screenshots/${locale}/overview.jpg"`));
        assert.ok(structured.find(item => item["@type"] === "SoftwareApplication").image.endsWith(`/screenshots/${locale}/overview.jpg`));
        assert.ok(!html.includes(`/screenshots/${locale === "en" ? "zh-TW" : "en"}/`));
        if (page === "product") {
          assert.ok(html.includes(`screenshots/${locale}/reference-desktop.png`));
          assert.ok(html.includes(`screenshots/${locale}/reference-phone.png`));
        }
      } else {
        assert.ok(!/<(?:img|picture|figure)\b/.test(html), `${locale}/${page} omits unmatched screenshots`);
        assert.ok(!html.includes('property="og:image"'));
        assert.ok(!html.includes('name="twitter:image"'));
        assert.ok(html.includes('name="twitter:card" content="summary"'));
        assert.ok(structured.every(item => !("image" in item)));
      }
    }
    const readme = translatedReadme(locale, content);
    assert.ok(readme.includes(demoLanguageBadge(locale)));
    assert.ok(readme.includes(demoUrlForLocale(locale, publicDemoUrl)));
    assert.equal(readme.includes("!["), supported);
    if (supported) assert.ok(readme.includes(`docs/screenshots/${locale}/playback.jpg`));
    assert.ok(!readme.includes("docs/stoolsense-"));
  }
  assert.equal(demoAssetCopies().length, 10);
  assert.equal(demoAssetForLocale("fr", "overview"), null);
  assert.throws(() => demoAssetForLocale("unknown", "overview"), /Unknown marketing locale/);
  assert.throws(() => demoAssetForLocale("en", "unknown"), /Unknown demo screenshot/);
});

test("example links align app and viewer language while retaining deployment prefixes", () => {
  assert.equal(demoUrlForLocale("en", "https://agent-canvas-app.pages.dev/demo/"), "https://agent-canvas-app.pages.dev/demo/?lang=en");
  assert.equal(demoUrlForLocale("zh-TW", "https://agent-canvas-app.pages.dev/demo/"), "https://agent-canvas-app.pages.dev/demo/zh-TW/?lang=zh-TW");
  assert.equal(demoUrlForLocale("zh-CN", "https://tombelieber.github.io/app-canvas/"), "https://tombelieber.github.io/app-canvas/zh-TW/?lang=zh-TW");
  assert.equal(demoUrlForLocale("ja", "https://tombelieber.github.io/app-canvas/"), "https://tombelieber.github.io/app-canvas/?lang=en");
  assert.equal(demoUrlForLocale("zh-TW", "https://example.com/nested/demo?ac_source=github"), "https://example.com/nested/demo/zh-TW/?ac_source=github&lang=zh-TW");
});

test("local demo commands use the same actual example language as the marketing demo link", async () => {
  const content = await loadContent();
  for (const locale of languages) {
    const expected = demoLocaleForLocale(locale) === "zh-TW" ? "agent-canvas demo --locale zh-TW" : "agent-canvas demo";
    assert.equal(commands(content.facts, locale).try.split("\n").at(-1), expected, `${locale} local example language`);
    assert.ok(renderPage(locale, "product", content).includes(`${expected}</code>`), `${locale} renders the matching command`);
  }
  assert.equal(commands(content.facts).try.split("\n").at(-1), "agent-canvas demo");
});

test("the free product journey uses a real demo, current install pins and visible limits", async () => {
  const content = await loadContent();
  const html = renderPage("en", "product", content);
  assert.ok(html.includes("<title>Agent Canvas — Visual Workspace for Claude Code &amp; Codex</title>"));
  assert.ok(html.includes("Build with agents.<br>Shape it live."));
  assert.ok(html.includes('rel="canonical" href="https://agent-canvas-app.pages.dev/"'));
  assert.ok(html.includes('hreflang="zh-TW" href="https://agent-canvas-app.pages.dev/about/zh-TW/"'));
  assert.ok(html.includes('href="/app-canvas/about/assets/launch.css"'));
  assert.ok(html.includes('data-action="demo"'));
  assert.ok(html.includes(`github:tombelieber/app-canvas#v${content.facts.version}`));
  assert.ok(html.includes("agent-canvas demo"));
  assert.ok(html.includes('data-page="product" data-version="'));
  assert.ok(html.includes('data-locale="en"'));
  assert.ok(html.includes('id="analytics-choice"'));
  assert.ok(html.includes('id="faq-title"'));
  assert.ok(!html.includes('class="cloud-link"'));
  for (const page of ["product", "start"]) {
    const freePage = renderPage("en", page, content);
    assert.ok(!freePage.includes('id="waitlist-form"'), `${page} has no Cloud signup barrier`);
    assert.ok(!freePage.includes('src="/app-canvas/about/assets/cloud.js"'), `${page} omits the waitlist handler`);
    assert.ok(freePage.includes('id="analytics-choice"'), `${page} retains a visible privacy choice`);
  }
  assert.ok(renderPage("en", "release", content).includes('id="waitlist-form"'));
  for (const locale of languages) {
    assert.equal(content.locales[locale].faq.length, 5);
    assert.ok(!content.locales[locale].steps[0][1].includes("v0.13.0"), `${locale} has no obsolete prerelease gate`);
    const readme = translatedReadme(locale, content);
    assert.ok(readme.includes("https://agent-canvas-app.pages.dev/demo/"));
    assert.ok(!readme.includes("https://tombelieber.github.io/app-canvas/about/"));
  }
});

test("Cloudflare marketing root and nested guides retain correct canonical and demo URLs", () => {
  const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `
    const {baseUrl,demoUrl,pagePath,pageUrl}=await import('./launch/content.mjs');
    console.log(JSON.stringify({baseUrl,demoUrl,home:pageUrl('en'),guide:pageUrl('en','start'),zh:pageUrl('zh-TW'),path:pagePath('en','start')}));
  `], { cwd: new URL("../", import.meta.url), env: { ...process.env, APP_CANVAS_SITE_URL: "https://agent-canvas-app.pages.dev/", APP_CANVAS_DEMO_URL: "https://agent-canvas-app.pages.dev/demo/" }, encoding: "utf8" }));
  assert.equal(result.home, "https://agent-canvas-app.pages.dev/");
  assert.equal(result.guide, "https://agent-canvas-app.pages.dev/about/start/");
  assert.equal(result.zh, "https://agent-canvas-app.pages.dev/about/zh-TW/");
  assert.equal(result.path, "/about/start/");
  assert.equal(result.demoUrl, "https://agent-canvas-app.pages.dev/demo/");
});

test("publishing launch pages preserves the demo and writes real screenshot bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "app-canvas-launch-"));
  try {
    await writeFile(join(directory, "index.html"), "existing demo");
    await writeFile(join(directory, "project.json"), '{"legacy":"preserved"}');
    assert.deepEqual(await buildLaunch(directory), { pages: 33, languages: 11 });
    assert.equal(await readFile(join(directory, "index.html"), "utf8"), "existing demo");
    assert.equal(await readFile(join(directory, "project.json"), "utf8"), '{"legacy":"preserved"}');
    for (const shot of demoAssetCopies()) {
      assert.deepEqual(await readFile(join(directory, "about/assets", shot.asset)), await readFile(new URL(`../${shot.source}`, import.meta.url)));
    }
    await assert.rejects(readFile(join(directory, "about/assets/overview.jpg")), { code: "ENOENT" });
    const sitemap = await readFile(join(directory, "sitemap.xml"), "utf8");
    assert.equal((sitemap.match(/<loc>/g) || []).length, 35);
    assert.ok(sitemap.includes("<loc>https://agent-canvas-app.pages.dev/demo/zh-TW/</loc>"));
    const launch = JSON.parse(await readFile(join(directory, "about/launch.json"), "utf8"));
    assert.deepEqual(launch.exampleLocales, ["en", "zh-TW"]);
    assert.deepEqual(launch.demos.map(demo => demo.url), ["https://agent-canvas-app.pages.dev/demo/?lang=en", "https://agent-canvas-app.pages.dev/demo/zh-TW/?lang=zh-TW"]);
    for (const locale of languages) {
      const url = new URL(pageUrl(locale, "start"));
      assert.ok((await readFile(join(directory, url.pathname.replace("/app-canvas/", ""), "index.html"), "utf8")).includes("populate --config ui-review/canvas.config.mjs --source-root . --verify"));
    }
    assert.ok((await readFile(join(directory, "llms-full.txt"), "utf8")).includes("complete"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
