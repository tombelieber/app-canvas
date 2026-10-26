import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { serveStatic } from "./serve-static.mjs";
import { verifyJourneys } from "../lib/verify.mjs";

const app = await serveStatic(process.env.APP_CANVAS_STATIC_DIR || ".artifacts/site");
const hasHan = text => /\p{Script=Han}/u.test(text);
const json = async path => {
  const response = await fetch(new URL(path, app.url));
  assert.equal(response.status, 200, path);
  return response.json();
};
let browser;
try {
  const [project, manifest, build, chinese, chineseManifest, chineseBuild] = await Promise.all([
    json("project.json"), json("manifest.json"), json("build.json"), json("zh-TW/project.json"), json("zh-TW/manifest.json"), json("zh-TW/build.json"),
  ]);
  assert.equal(build.demoLocale, "en");
  assert.equal(chineseBuild.demoLocale, "zh-TW");
  assert.equal(project.catalog.length, 77);
  assert.equal(project.journeys.length, 121);
  assert.equal(hasHan(JSON.stringify({ catalog: project.catalog, pages: project.pages, groups: project.groups, flows: project.flows, journeys: project.journeys })), false);
  assert.equal(hasHan(JSON.stringify(chinese.catalog)), true);
  assert.deepEqual(project.catalog.map(screen => screen.id), chinese.catalog.map(screen => screen.id));
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1512, height: 982 }, permissions: ["clipboard-read", "clipboard-write"] });
  await context.addInitScript(() => { if (window.top === window) { try { localStorage.setItem("app-canvas:telemetry", "false"); } catch {} } });
  const cases = [], errors = [];
  let index = 0;
  // Bound rendered work while proving every actual frozen app case, rather
  // than checking screenshots or just the outer viewer's translated labels.
  await Promise.all(Array.from({ length: 3 }, async () => {
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    try {
      while (index < project.catalog.length) {
        const screen = project.catalog[index++], url = new URL(manifest.screens[screen.id].url, app.url);
        assert.equal(url.origin, new URL(app.url).origin);
        await page.goto(url.href);
        await page.locator('html[data-review-ready="true"]').waitFor();
        const result = await page.evaluate(() => ({ lang: document.documentElement.lang, text: document.body.innerText, errors: window.__review?.errors || [] }));
        assert.equal(result.lang, "en", screen.id);
        assert.equal(hasHan(result.text), false, `${screen.id}: English source frame contains untranslated UI`);
        assert.deepEqual(result.errors, [], screen.id);
        if (screen.id === "result-photo") {
          await page.waitForFunction(() => document.images.length > 0 && [...document.images].every(image => image.complete && image.naturalWidth > 0));
          assert.equal(await page.locator("img").first().getAttribute("src"), "./sample.png", "exported photo uses its relative asset");
        }
        if (screen.id === "import-home") {
          const href = await page.locator("a[download]").first().getAttribute("href"), csv = new URL(href, page.url());
          assert.equal(href, "./diet-template.csv", "exported template stays inside its locale frame path");
          assert.equal(csv.origin, new URL(app.url).origin);
          const response = await page.request.get(csv.href);
          assert.equal(response.status(), 200);
          assert.equal(hasHan(await response.text()), false, "actual English CSV fixture matches the English profile");
        }
        cases.push({ id: screen.id, locale: result.lang, noHan: true });
      }
    } finally { await page.close(); }
  }));
  const chinesePage = await context.newPage();
  await chinesePage.goto(new URL(chineseManifest.screens["capture-home"].url, new URL("zh-TW/", app.url)).href);
  await chinesePage.locator('html[data-review-ready="true"]').waitFor();
  assert.match(await chinesePage.locator("html").getAttribute("lang"), /^zh/);
  assert.equal(hasHan(await chinesePage.locator("body").innerText()), true, "Chinese route serves the original Chinese app");
  await chinesePage.close();

  const page = await context.newPage(), downloads = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("download", download => downloads.push(download.suggestedFilename()));
  for (const [start, requested, target, actual] of [
    ["", "zh-TW", "zh-TW/", "zh-TW"], ["", "zh-CN", "zh-TW/", "zh-TW"], ["zh-TW/", "en", "", "en"],
  ]) {
    const url = new URL(start, app.url);
    url.search = `?lang=${requested}&ac_source=founder_social&ac_campaign=oss_launch`;
    url.hash = "reference";
    let navigations = 0;
    const count = request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++; };
    page.on("request", count);
    await page.goto(url.href);
    await page.waitForURL(current => current.pathname === new URL(target, app.url).pathname);
    await page.locator('.review-workspace[data-live-ready="true"][data-camera-ready="true"]').waitFor({ timeout: 45000 });
    const final = new URL(page.url());
    assert.equal(final.searchParams.get("ac_source"), "founder_social");
    assert.equal(final.searchParams.get("ac_campaign"), "oss_launch");
    assert.equal(final.hash, "#reference");
    assert.equal(await page.locator("html").getAttribute("lang"), actual);
    assert.ok(navigations <= 2, `${requested}: locale route must not loop`);
    page.off("request", count);
  }
  await page.goto(`${app.url}?lang=en`);
  await page.locator('.review-workspace[data-live-ready="true"][data-camera-ready="true"]').waitFor({ timeout: 45000 });
  const journeys = [];
  await verifyJourneys({ page, journeys: project.journeys, onResult: result => journeys.push(result) });
  assert.equal(journeys.length, 121);
  for (const id of ["record-happy", "record-offline", "result-edit", "event-delete", "import-csv", "original-export", "export-documents"]) {
    assert.ok(journeys.some(result => result.id === id && result.passed), `${id}: actual English interaction outcome`);
  }
  assert.ok(downloads.some(name => name.endsWith(".json")), "real JSON export download");
  assert.ok(downloads.some(name => name.endsWith(".html")), "real HTML export download");
  assert.ok(downloads.some(name => name.endsWith(".zip")), "real ZIP export download");

  const reference = await context.newPage();
  await reference.goto(`${app.url}?lang=en`);
  await reference.locator('.review-workspace[data-live-ready="true"]').waitFor({ timeout: 45000 });
  await reference.getByLabel("Search screens", { exact: true }).fill("capture-home");
  await reference.locator('[title="capture-home"]').click();
  await reference.getByRole("button", { name: "Point to an element", exact: true }).click();
  const frame = reference.frameLocator('iframe[data-screen="capture-home"]');
  await frame.locator("html[data-agent-canvas-picking]").waitFor();
  await frame.locator("#manual").click();
  await reference.getByText("Selected element:", { exact: false }).waitFor();
  assert.equal(await frame.locator("#save-form").count(), 0, "pointing did not invoke the app's manual-entry action");
  await reference.getByLabel("What should change?", { exact: true }).fill("Make this button easier to find.");
  await reference.getByRole("button", { name: "Copy change request", exact: true }).click();
  await reference.getByText("Copied. Paste into Claude Code, Codex, or your coding agent.", { exact: true }).waitFor();
  const prompt = await reference.evaluate(() => navigator.clipboard.readText());
  assert.match(prompt, /capture-home/); assert.match(prompt, /client\/capture\.js/); assert.match(prompt, /#manual/);
  assert.equal(hasHan(prompt), false, "English source reference is English too");
  assert.deepEqual(errors, []);
  await mkdir(".artifacts/locale", { recursive: true });
  await writeFile(".artifacts/locale/browser-proof.json", JSON.stringify({ build, cases, journeys, downloads, chineseOriginal: true, redirectsPreserveAttribution: true, englishReferenceCopied: true }, null, 2));
  console.log("PASS English published demo: 77 real source cases, 121 actual journeys, save/edit/delete/import/export downloads, clipboard reference, original Chinese route and bounded locale redirects.");
} finally { await browser?.close(); await app.close(); }
