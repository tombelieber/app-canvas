import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { startCanvas, packageRoot } from "../lib/server.mjs";
await mkdir(".artifacts", { recursive: true });
const app = await startCanvas({ root: packageRoot, configPath: "examples/stoolsense/canvas.config.mjs", port: 0, watchFiles: false });
try {
  const outDir = process.env.APP_CANVAS_STATIC_DIR || ".artifacts/site";
  const result = await app.exportStatic({ outDir });
  const pkg = JSON.parse(await readFile("package.json"));
  await writeFile(`${outDir}/build.json`, JSON.stringify({ commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), version: pkg.version, cases: result.total }, null, 2));
  console.log(`Static demo: ${result.total} interactive cases in ${outDir}`);
} finally { await app.close(); }
