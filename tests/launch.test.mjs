import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadContent, validateLocales, languages, pageUrl, commands } from "../launch/content.mjs";
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
      assert.ok(html.includes(`rel="canonical" href="${pageUrl(locale, page)}"`));
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

test("publishing launch pages preserves the demo and writes real screenshot bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "app-canvas-launch-"));
  try {
    await writeFile(join(directory, "index.html"), "existing demo");
    await writeFile(join(directory, "project.json"), '{"legacy":"preserved"}');
    assert.deepEqual(await buildLaunch(directory), { pages: 33, languages: 11 });
    assert.equal(await readFile(join(directory, "index.html"), "utf8"), "existing demo");
    assert.equal(await readFile(join(directory, "project.json"), "utf8"), '{"legacy":"preserved"}');
    assert.deepEqual(await readFile(join(directory, "about/assets/overview.jpg")), await readFile(new URL("../docs/stoolsense-overview.jpg", import.meta.url)));
    const sitemap = await readFile(join(directory, "sitemap.xml"), "utf8");
    assert.equal((sitemap.match(/<loc>/g) || []).length, 34);
    for (const locale of languages) {
      const url = new URL(pageUrl(locale, "start"));
      assert.ok((await readFile(join(directory, url.pathname.replace("/app-canvas/", ""), "index.html"), "utf8")).includes("populate --config ui-review/canvas.config.mjs --source-root . --verify"));
    }
    assert.ok((await readFile(join(directory, "llms-full.txt"), "utf8")).includes("complete"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
