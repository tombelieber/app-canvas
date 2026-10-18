import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { startCanvas, packageRoot } from "../lib/server.mjs";
import { caseCoverage, graphFlows } from "../lib/coverage.mjs";
import { canvasHtml } from "../lib/html.mjs";
import { officialEndpoint } from "../lib/telemetry.mjs";
import { buildLaunch } from "./build-launch.mjs";
await mkdir(".artifacts", { recursive: true });
const app = await startCanvas({ root: packageRoot, configPath: "examples/stoolsense/canvas.config.mjs", port: 0, watchFiles: false });
try {
  const outDir = process.env.APP_CANVAS_STATIC_DIR || ".artifacts/site";
  const result = await app.exportStatic({ outDir });
  const pkg = JSON.parse(await readFile("package.json"));
  const project = JSON.parse(await readFile(`${outDir}/project.json`));
  const coverage = caseCoverage(project);
  await writeFile(`${outDir}/build.json`, JSON.stringify({ commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), version: pkg.version, cases: result.total, playableCases: coverage.checked, flows: coverage.flows, journeys: project.journeys.length, connections: graphFlows(project).length }, null, 2));
  await writeFile(`${outDir}/telemetry.json`, JSON.stringify({enabled:true,configurable:true,version:pkg.version,source:"browser",surface:"official_demo",endpoint:officialEndpoint}));
  await writeFile(`${outDir}/index.html`, canvasHtml({assetVersion: app.getManifest().canvasHash, telemetryOrigin:new URL(officialEndpoint).origin}));
  const launch = await buildLaunch(outDir);
  console.log(`Launch materials: ${launch.pages} pages in ${launch.languages} languages`);
  console.log(`Static demo: ${result.total} interactive cases in ${outDir}`);
} finally { await app.close(); }
