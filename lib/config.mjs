import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { validateProject } from "./protocol.mjs";
import { checkRouteCoverage } from "./routes.mjs";
import { checkSourceCoverage } from "./inventory.mjs";
import { checkUiCoverage } from "./ui-coverage.mjs";
export async function loadProject(configPath, root, { complete = false, uiComplete = false, prepare = false } = {}) {
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
  const input = module.default;
  if (complete && uiComplete) throw Error('Choose UI delivery or strict source audit separately');
  const project = validateProject(complete ? { ...input, coverage: { ...input.coverage, requireSourceInventory: true, requireAllCases: true, requireConnected: true } } : uiComplete ? { ...input, coverage: { ...input.coverage, requireAllCases: true, requireConnected: true } } : input);
  if (prepare) return project;
  await checkRouteCoverage(project, root);
  if (!complete && (uiComplete || project.uiCoverage)) project.uiCoverageReport = await checkUiCoverage(project, root);
  else project.sourceCoverageReport = await checkSourceCoverage(project, root, { complete });
  return project;
}
