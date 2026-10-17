import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const nonempty = value => typeof value === "string" && value.trim().length > 0;

export async function validatePopulationProof({ root, project, proof }) {
  const report = project.sourceCoverageReport;
  if (!proof || !Array.isArray(proof.cases) || !report?.requiredEvidence) throw Error("Complete validation needs source-linked runtime evidence from the project verify hook");
  if (!nonempty(report.digest) || proof.sourceDigest !== report.digest) throw Error("Runtime evidence source digest does not match the current source revision");
  const observed = new Map(), catalog = new Set(project.catalog.map(item => item.id));
  for (const entry of proof.cases) {
    if (!catalog.has(entry.id) || !["web", "native"].includes(entry.runtime) || !nonempty(entry.fixtureId) || !nonempty(entry.buildId)) throw Error("Runtime evidence needs a registered case, runtime, build and fixture identity");
    if (!Array.isArray(entry.assertions) || !entry.assertions.length) throw Error(`Runtime evidence needs distinguishing state assertions: ${entry.id}`);
    if (entry.runtime === "native") {
      if (!nonempty(entry.platform) || !nonempty(entry.capture?.path) || isAbsolute(entry.capture.path) || !/\.(png|jpe?g|webp)$/i.test(entry.capture.path)) throw Error(`Native runtime evidence needs a platform and local capture: ${entry.id}`);
      const absolute = await realpath(resolve(root, entry.capture.path)), fromRoot = relative(await realpath(root), absolute);
      if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) throw Error("Native capture leaves the project directory");
      const digest = createHash("sha256").update(await readFile(absolute)).digest("hex");
      if (digest !== entry.capture.sha256) throw Error(`Native capture integrity changed: ${entry.id}`);
    }
    const sources = observed.get(entry.id) || new Map();
    for (const assertion of entry.assertions) {
      if (!nonempty(assertion.id) || assertion.passed !== true || !Array.isArray(assertion.sources) || !assertion.sources.length) throw Error(`Missing or failed source-linked state assertion: ${entry.id}`);
      for (const id of assertion.sources) {
        const candidates = report.requiredEvidence[entry.id]?.filter(item => item.id === id) || [];
        if (!candidates.length) throw Error(`Runtime assertion references an unrelated source obligation: ${entry.id}`);
        const expected = candidates.find(item => !item.platform || item.platform === "web" && entry.runtime === "web" || entry.runtime === "native" && [entry.platform, "native"].includes(item.platform));
        if (!expected) throw Error(`Runtime platform cannot establish source evidence: ${entry.id}`);
        sources.set(`${id}:${expected.platform || "any"}`, true);
      }
    }
    observed.set(entry.id, sources);
  }
  for (const id of catalog) {
    if (!observed.has(id)) throw Error(`Missing runtime evidence for canvas case: ${id}`);
    for (const source of report.requiredEvidence[id] || []) if (!observed.get(id).has(`${source.id}:${source.platform || "any"}`)) throw Error(`Missing runtime evidence for source obligation: ${id}:${source.id}`);
  }
}
