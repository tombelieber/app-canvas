import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { discoverSources } from "./discovery.mjs";
import { checkDiscoveryCoverage } from "./discovery-coverage.mjs";
export { discoverSources };

const kinds = new Set(["screen", "component", "state", "variant", "navigation"]);
const nonempty = value => typeof value === "string" && value.trim().length > 0;

function localPath(root, path) {
  if (!nonempty(path) || isAbsolute(path)) throw Error("Source inventory paths must be repository-relative");
  const absolute = resolve(root, path), fromRoot = relative(root, absolute);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) throw Error(`Source inventory path leaves repository: ${path}`);
  return absolute;
}

// Fingerprints detect drift in the agent's reviewed scope. This deliberately
// does not pretend a language-agnostic file scan discovers UI semantics.
export async function inventorySources(root, roots) {
  root = resolve(root);
  if (!Array.isArray(roots) || !roots.length) throw Error("Source inventory needs nonempty roots");
  const files = new Map();
  async function visit(path) {
    const info = await lstat(path);
    if (info.isDirectory()) {
      for (const child of (await readdir(path)).sort()) await visit(join(path, child));
    } else if (info.isFile()) {
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(path)) hash.update(chunk);
      files.set(relative(root, path).split(sep).join("/"), hash.digest("hex"));
    } else {
      throw Error(`Source inventory needs an explicit regular source path, not a link: ${path}`);
    }
  }
  for (const path of roots) await visit(localPath(root, path));
  return [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, sha256]) => ({ path, sha256 }));
}

export async function checkSourceCoverage(project, root, { complete = false } = {}) {
  root = resolve(root);
  const config = project.sourceCoverage;
  if (!config) {
    if (complete || project.coverage?.requireSourceInventory) throw Error("Source inventory is required for complete UI coverage");
    return undefined;
  }
  const inventory = JSON.parse(await readFile(localPath(root, config.inventory), "utf8"));
  if (complete && inventory.version !== 2) throw Error("Complete validation needs a version 2 source discovery worklist; a hand-authored inventory is insufficient");
  if (![1, 2].includes(inventory.version) || !Array.isArray(inventory.files)) throw Error("Source inventory needs version 1 or 2 and files");
  const sourceRoot = inventory.version === 2 && inventory.sourceRoot !== undefined ? resolve(dirname(localPath(root, config.inventory)), inventory.sourceRoot) : resolve(root, config.repository || ".");
  const discovery = inventory.version === 2 ? await discoverSources(sourceRoot, { exclude: [relative(sourceRoot, localPath(root, config.inventory)).split(sep).join("/")] }) : undefined;
  const actual = discovery?.files || await inventorySources(root, config.roots);
  const files = new Map();
  for (const file of inventory.files) {
    if (!nonempty(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256 || "")) throw Error("Source inventory needs file paths and SHA-256 fingerprints");
    if (files.has(file.path)) throw Error(`Duplicate source inventory file: ${file.path}`);
    if (file.nonUiReason !== undefined && !nonempty(file.nonUiReason)) throw Error(`Non-UI source needs a reason: ${file.path}`);
    files.set(file.path, file);
  }
  const live = new Map(actual.map(file => [file.path, file.sha256]));
  const changed = new Set([
    ...actual.filter(file => files.get(file.path)?.sha256 !== file.sha256).map(file => file.path),
    ...[...files.keys()].filter(path => !live.has(path)),
  ]);
  if (changed.size) throw Error(`Source inventory changed: ${[...changed].join(", ")}. Reinspect affected UI and update its items, cases and fingerprints.`);
  const discoveryReport = discovery ? checkDiscoveryCoverage(discovery, inventory) : undefined;
  if (!files.size) throw Error("Source inventory roots contain no files");
  if (!Array.isArray(inventory.items) || !inventory.items.length) throw Error("Source inventory needs discovered UI items");
  const ids = new Set(), mappedSources = new Set(), mappedCases = new Set();
  const cases = new Set(project.catalog.map(screen => screen.id));
  for (const item of inventory.items) {
    if (!nonempty(item.id) || !kinds.has(item.kind)) throw Error("Source inventory items need IDs and a supported kind");
    if (ids.has(item.id)) throw Error(`Duplicate source inventory item: ${item.id}`);
    ids.add(item.id);
    if (!Array.isArray(item.sources) || !item.sources.length) throw Error(`Inventory item ${item.id} needs source references`);
    for (const path of item.sources) {
      if (!files.has(path)) throw Error(`Inventory item ${item.id} references unscanned source: ${path}`);
      if (files.get(path).nonUiReason) throw Error(`Inventory item ${item.id} references non-UI source: ${path}`);
      mappedSources.add(path);
    }
    if (item.blocker || (item.status !== undefined && item.status !== "covered")) throw Error(`Inventory item ${item.id} is incomplete: ${item.blocker || item.status}`);
    if (!Array.isArray(item.cases) || !item.cases.length) throw Error(`Inventory item ${item.id} has no canvas case`);
    for (const id of item.cases) {
      if (!cases.has(id)) throw Error(`Inventory item ${item.id} references missing canvas case: ${id}`);
      mappedCases.add(id);
    }
  }
  const unmappedSources = [...files.values()].filter(file => !file.nonUiReason && !mappedSources.has(file.path));
  if (unmappedSources.length) throw Error(`UI sources missing inventory items: ${unmappedSources.map(file => file.path).join(", ")}`);
  const unmappedCases = [...cases].filter(id => !mappedCases.has(id));
  if (unmappedCases.length) throw Error(`Catalog cases missing source inventory items: ${unmappedCases.join(", ")}`);
  return { files: files.size, items: ids.size, cases: mappedCases.size, ...(discoveryReport ? { ...discoveryReport, sourceRoot, digest: createHash("sha256").update(JSON.stringify(actual)).digest("hex") } : {}) };
}
