import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { buildEnglishDemo } from "../examples/stoolsense/build-locales.mjs";
import { localizeJavaScript, localizeObject, localizeHtml, hasHan } from "../examples/stoolsense/locale-source.mjs";
import { createJourneys as originalJourneys } from "../examples/stoolsense/journeys.mjs";
import { createJourneys as englishJourneys } from "../examples/stoolsense/locales/en/journeys.mjs";
import { relocateStoolSenseAssets } from "../examples/stoolsense/static.mjs";

const root = new URL("../examples/stoolsense/", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const sha = text => createHash("sha256").update(text).digest("hex");
const assertStableValues = (original, localized, path = "") => {
  assert.equal(typeof localized, typeof original, path);
  if (typeof original === "string") { if (!hasHan(original)) assert.equal(localized, original, path); }
  else if (original && typeof original === "object") {
    assert.deepEqual(Object.keys(localized), Object.keys(original), path);
    for (const key of Object.keys(original)) assertStableValues(original[key], localized[key], `${path}.${key}`);
  } else assert.equal(localized, original, path);
};

test("English generated renderer and metadata are reproducible from the pinned frozen source", async () => {
  assert.equal((await buildEnglishDemo({ check: true })).length, 8);
  const provenance = JSON.parse(await read("locales/en/provenance.json"));
  assert.equal(provenance.sourceFrontendCommit, "86066485a0619c5e3368906875d8ca7fe5d093d2");
  assert.equal(provenance.sourceBundleSha256, sha(await read("public/frame.js")));
  assert.equal(provenance.dictionarySha256, sha(await read("locales/en.json")));
  assert.equal(provenance.expectationsSha256, sha(await read("locales/en-expectations.json")));
  for (const [path, digest] of Object.entries(provenance.outputs)) {
    const text = await read(path);
    assert.equal(sha(text), digest, path);
    assert.equal(hasHan(text), false, `${path} must be genuinely English before execution`);
  }
  assert.match(await read("public/en/index.html"), /<html lang="en">/);
  assert.match(await read("public/index.html"), /<html lang="zh-Hant-HK">/, "original Chinese shell is preserved");
});

test("English catalog and every playable journey preserve stable source IDs, selectors, actions and enum values", async () => {
  const original = JSON.parse(await read("catalog.json")), english = JSON.parse(await read("locales/en/catalog.json"));
  assert.equal(english.catalog.length, 77);
  assertStableValues(original, english);
  const zhJourneys = originalJourneys(original.catalog), enJourneys = englishJourneys(english.catalog);
  assert.equal(enJourneys.length, 121);
  assert.equal(enJourneys.filter(journey => journey.kind !== "case").length, 44);
  assertStableValues(zhJourneys, enJourneys);
  assert.equal(hasHan(JSON.stringify(enJourneys)), false);
});

test("source localization preserves template interpolation and cannot turn translated content into code", () => {
  const source = 'globalThis.result = `原相 ${1 + 1} 已保存`;';
  const code = localizeJavaScript(source, { "原相 ": "Original photo ", " 已保存": " saved" });
  const scope = {};
  runInNewContext(code, scope);
  assert.equal(scope.result, "Original photo 2 saved");
  const injected = {};
  runInNewContext(localizeJavaScript('globalThis.result = "未填";', { "未填": '";globalThis.injected=true;//' }), injected);
  assert.equal(injected.injected, undefined);
  assert.equal(injected.result, '";globalThis.injected=true;//');
  assert.throws(() => localizeJavaScript('globalThis.result = "新訊息";', {}), /Missing reviewed English message/);
  assert.throws(() => localizeObject({ title: "新訊息" }, {}), /Missing reviewed English message/);
  assert.equal(localizeHtml('<html lang="zh-Hant"><button id="save">保存</button></html>', { "保存": "Save" }), '<html lang="en"><button id="save">Save</button></html>');
  const contextual = {};
  runInNewContext(localizeJavaScript('const expect = (selector, text) => text; globalThis.title = "飲食"; globalThis.expected = expect("#message", "飲食");', { "飲食": "Food" }, "journeys.mjs", { "飲食": "food" }), contextual);
  assert.equal(contextual.title, "Food", "UI copy keeps natural heading case");
  assert.equal(contextual.expected, "food", "fixed behavioral snippets match their rendered sentence context");
});

test("localized count assertions keep exact numeric boundaries", async () => {
  const expected = JSON.parse(await read("locales/en-expectations.json"));
  assert.equal("User corrections: 10; analysis versions: 10.".includes(expected["用戶修正 1 次"]), false);
  assert.equal("User corrections: 10; analysis versions: 10.".includes(expected["分析 1 個版本"]), false);
  assert.equal("Delete selected entries: 10?".includes(expected["所選 1 筆"]), false);
  assert.equal("Entries deleted: 10.".includes(expected["已刪除 1 筆"]), false);
});

test("static localization relocates the exact original and English asset literals and rejects changed inputs", async () => {
  for (const [locale, path] of [["zh-TW", "public/frame.js"], ["en", "public/en/frame.js"]]) {
    const source = await read(path), code = relocateStoolSenseAssets(source, locale);
    assert.equal((code.match(/(?:src|href)="\.\/sample\.png"/g) || []).length, 2, locale);
    assert.ok(code.includes('"./sample.png"'), locale);
    assert.equal(code.includes('"/sample.png"'), false, locale);
    assert.equal((code.match(/(?:src|href)="\/api\/images\/\$\{[^}]+\}"/g) || []).length, 0, locale);
    const quote = locale === "en" ? '\\"' : '"';
    assert.ok(code.includes(`href=${quote}./diet-template.csv${quote}`), locale);
    assert.equal(code.includes(`href=${quote}/diet-template.csv${quote}`), false, locale);
    assert.throws(() => relocateStoolSenseAssets(source + `
// href=${quote}/diet-template.csv${quote}`, locale), /Frozen frontend changed/);
    assert.throws(() => relocateStoolSenseAssets(source.replace('"/sample.png"', '"/other.png"'), locale), /Frozen frontend changed/);
  }
});
