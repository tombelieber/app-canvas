import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { localizeJavaScript, localizeObject, localizeHtml, localizeCsv } from "./locale-source.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const read = path => readFile(join(root, path), "utf8");

// Compile reviewed messages into the already-public frozen renderer before it
// executes. Never read a later private application checkout or rewrite live DOM.
export async function buildEnglishDemo({ outDir = root, check = false } = {}) {
  const [frame, html, catalog, journeys, baseline, dictionaryText, recipe, compiler, originalProvenance, csv, invalidCsv, expectationsText] = await Promise.all([
    read("public/frame.js"), read("public/index.html"), read("catalog.json"), read("journeys.mjs"), read("journeys.json"),
    read("locales/en.json"), read("build-locales.mjs"), read("locale-source.mjs"), read("provenance.json"),
    read("public/diet-template.csv"), read("public/invalid-meals.csv"),
    read("locales/en-expectations.json"),
  ]);
  const provenance = JSON.parse(originalProvenance), dictionary = JSON.parse(dictionaryText), expectations = JSON.parse(expectationsText);
  if (provenance.frontendCommit !== "86066485a0619c5e3368906875d8ca7fe5d093d2") throw Error("Frozen source revision changed; review the English localization before rebuilding");
  const outputs = {
    "public/en/frame.js": localizeJavaScript(frame, dictionary),
    "public/en/index.html": localizeHtml(html, dictionary),
    "public/en/diet-template.csv": localizeCsv(csv, dictionary),
    "public/en/invalid-meals.csv": localizeCsv(invalidCsv, dictionary),
    "locales/en/catalog.json": JSON.stringify(localizeObject(JSON.parse(catalog), dictionary), null, 2) + "\n",
    "locales/en/journeys.mjs": localizeJavaScript(journeys, dictionary, "journeys.mjs", expectations),
    "locales/en/journeys.json": JSON.stringify(localizeObject(JSON.parse(baseline), dictionary, expectations), null, 2) + "\n",
  };
  outputs["locales/en/provenance.json"] = JSON.stringify({
    example: "StoolSense", locale: "en", data: "synthetic only", sourceFrontendCommit: provenance.frontendCommit,
    sourceGeneratedAt: provenance.generatedAt, sourceBundleSha256: sha256(frame), sourceShellSha256: sha256(html),
    sourceCatalogSha256: sha256(catalog), sourceJourneysSha256: sha256(journeys), sourceBaselineJourneysSha256: sha256(baseline),
    sourceCsvSha256: sha256(csv), sourceInvalidCsvSha256: sha256(invalidCsv),
    dictionarySha256: sha256(dictionaryText), expectationsSha256: sha256(expectationsText), recipeSha256: sha256(recipe + "\n" + compiler),
    method: "Reviewed cooked JavaScript literal/template, HTML and metadata translations compiled from the frozen source before execution. No DOM translation or screenshot overlay.",
    outputs: Object.fromEntries(Object.entries(outputs).map(([path, content]) => [path, sha256(content)])),
  }, null, 2) + "\n";
  for (const [path, content] of Object.entries(outputs)) {
    const destination = join(outDir, path);
    if (check) {
      if (await readFile(destination, "utf8") !== content) throw Error(`Stale localized demo: ${path}`);
    } else { await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, content); }
  }
  return Object.keys(outputs);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = await buildEnglishDemo({ check: process.argv.includes("--check") });
  console.log(`${paths.length} source-derived English demo files ${process.argv.includes("--check") ? "verified" : "generated"}`);
}
