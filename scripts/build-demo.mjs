import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { startCanvas, packageRoot } from "../lib/server.mjs";
import { caseCoverage, graphFlows } from "../lib/coverage.mjs";
import { canvasHtml } from "../lib/html.mjs";
import { officialEndpoint } from "../lib/telemetry.mjs";
import { buildLaunch } from "./build-launch.mjs";
const out = process.env.APP_CANVAS_STATIC_DIR || ".artifacts/site";
const pkg = JSON.parse(await readFile("package.json"));
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
await mkdir(".artifacts", { recursive: true });
for (const locale of ["en", "zh-TW"]) await buildDemo(locale, locale === "en" ? out : join(out, "zh-TW"));
const launch = await buildLaunch(out);
console.log(`Launch materials: ${launch.pages} pages in ${launch.languages} languages`);

async function buildDemo(locale, outDir) {
 const app = await startCanvas({ root: packageRoot, configPath: `examples/stoolsense/${locale === "en" ? "canvas.en.config.mjs" : "canvas.config.mjs"}`, port: 0, watchFiles: false });
 try {
  const result = await app.exportStatic({ outDir });
  const project = JSON.parse(await readFile(`${outDir}/project.json`));
  const coverage = caseCoverage(project);
  await writeFile(join(outDir, "build.json"), JSON.stringify({ commit, version: pkg.version, demoLocale: locale, availableDemoLocales: ["en", "zh-TW"], cases: result.total, playableCases: coverage.checked, flows: coverage.flows, journeys: project.journeys.length, connections: graphFlows(project).length }, null, 2));
  await writeFile(`${outDir}/telemetry.json`, JSON.stringify({enabled:true,configurable:true,version:pkg.version,source:"browser",surface:"official_demo",environment:"production",cohort_class:"unknown",endpoint:officialEndpoint}));
  const version = encodeURIComponent(app.getManifest().canvasHash);
  const html = canvasHtml({assetVersion: app.getManifest().canvasHash, telemetryOrigin:new URL(officialEndpoint).origin});
  await writeFile(join(outDir, "index.html"), html.replace(`./assets/canvas.js?v=${version}`, `./assets/demo-entry.js?v=${version}`));
  // Resolve the old ?lang=zh-TW link before boot. These are complete authored
  // examples, including measured DOM and journeys, not DOM translations.
  await writeFile(join(outDir, "assets/demo-entry.js"), `const locale=${JSON.stringify(locale)};
const url=new URL(location.href), requested=url.searchParams.get('lang');
const target=requested==='zh-TW'||requested==='zh-CN'?'zh-TW':requested==='en'?'en':locale;
if(target!==locale){const next=new URL(locale==='en'?'./zh-TW/':'../',url);next.search=url.search;next.hash=url.hash;next.searchParams.set('lang',target);location.replace(next.href);}
else{url.searchParams.set('lang',locale);history.replaceState(null,'',url);await import('./canvas.js?v=${version}');}
`);
  console.log(`Static ${locale} demo: ${result.total} interactive cases in ${outDir}`);
 } finally { await app.close(); }
}
