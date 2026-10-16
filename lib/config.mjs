import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { validateProject } from "./protocol.mjs";
import { checkRouteCoverage } from "./routes.mjs";
import { checkSourceCoverage } from "./inventory.mjs";
export async function loadProject(configPath, root) {
  const path = resolve(root, configPath),
    key = createHash("sha256").update(path).digest("hex").slice(0, 16),
    output = join(root, `node_modules/.cache/app-canvas/config-${key}.mjs`);
  await mkdir(dirname(output), { recursive: true });
  await build({
    absWorkingDir: root,
    entryPoints: [path],
    bundle: true,
    packages: "external",
    platform: "node",
    format: "esm",
    outfile: output,
    logLevel: "silent",
  });
  const module = await import(`${pathToFileURL(output).href}?v=${Date.now()}`);
  const project = validateProject(module.default);
  await checkRouteCoverage(project, root);
  project.sourceCoverageReport = await checkSourceCoverage(project, root);
  return project;
}
