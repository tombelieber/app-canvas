import { mkdir, open, lstat, rename, rm, rmdir, readdir, mkdtemp } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname, resolve, isAbsolute } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { storageHome, contains, projectLocation } from "./location.mjs";
import { validateProject, validateDocument, identity, limits } from "./schema.mjs";
import { inspectAsset, requireAssets } from "./assets.mjs";
import { applyEdits } from "./patches.mjs";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
// The index repeats asset IDs as both paths and hashes; allow the full existing
// project metadata budget without imposing a smaller resource-count limit.
const manifestLimit = limits.state * 4;
const validId = id => { if (!/^[a-f0-9]{64}$/.test(id)) throw Error("Invalid recovery ID"); return id; };
const validPath = path => path === "project.json" || /^documents\/[a-zA-Z0-9_-]+\.json$/.test(path) || /^references\/[a-zA-Z0-9_-]+\.png$/.test(path) || /^assets\/[a-f0-9]{64}$/.test(path);

async function secureDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  let current = resolve(path);
  for (;;) {
    if (!(await lstat(current)).isDirectory() || (await lstat(current)).isSymbolicLink()) throw Error("Unsafe recovery directory");
    if (dirname(current) === current) break; current = dirname(current);
  }
}
async function readChecked(path, max) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { const stat = await handle.stat(); if (!stat.isFile() || stat.size > max) throw Error("Recovery file exceeds size limit"); return await handle.readFile(); }
  finally { await handle.close(); }
}
async function syncedWrite(path, bytes, replace = false) {
  const temp = replace ? join(dirname(path), `.checkpoint-${randomUUID()}.tmp`) : path;
  const handle = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  if (replace) { try { await rename(temp, path); await syncDirectory(dirname(path)); } finally { await rm(temp, { force: true }); } }
}
async function syncDirectory(path) {
  const handle = await open(path, constants.O_RDONLY);
  try { await handle.sync(); } finally { await handle.close(); }
}
async function vault(directory) {
  const home = await storageHome();
  // A checkpoint must survive removal of its source directory and vice versa.
  if (contains(directory, home)) throw Error("Project cannot contain its recovery storage");
  const objects = join(home, "objects"), checkpoints = join(home, "checkpoints");
  await secureDirectory(objects); await secureDirectory(checkpoints);
  return { home, objects, checkpoints, id: digest(directory) };
}
async function manifest(path) {
  const record = JSON.parse(await readChecked(path, manifestLimit));
  if (record.version !== 1 || !Array.isArray(record.files) || typeof record.directory !== "string" || !isAbsolute(record.directory) || !Number.isInteger(record.revision) || record.revision < 0 || typeof record.title !== "string") throw Error("Invalid recovery checkpoint");
  const paths = new Set(); let size = 0;
  for (const file of record.files) {
    if (!validPath(file.path) || paths.has(file.path) || !Number.isInteger(file.bytes) || file.bytes < 0 || file.bytes > limits.state) throw Error("Invalid recovery file");
    validId(file.sha256); paths.add(file.path); size += file.bytes;
  }
  if (!paths.has("project.json") || size > limits.project + limits.state) throw Error("Invalid recovery checkpoint size");
  return record;
}
export async function checkpoint(directory, project, read) {
  const storage = await vault(directory), pointer = join(storage.checkpoints, `${storage.id}.json`);
  try {
    const previous = await manifest(pointer);
    if (previous.revision > project.revision) throw Error(`Recovery checkpoint is ahead of this project. Use app-canvas recover ${storage.id} to restore it without overwriting local files.`);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const files = [], paths = new Set();
  const add = async (path, bytes) => {
    if (paths.has(path)) return;
    paths.add(path);
    const sha256 = digest(bytes), object = join(storage.objects, sha256);
    try { if (digest(await readChecked(object, limits.state)) !== sha256) throw Error("Recovery object integrity mismatch"); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      // Publish immutable objects by rename: an interrupted write is never reused.
      const temp = join(storage.objects, `.object-${randomUUID()}.tmp`);
      try { await syncedWrite(temp, bytes); await rename(temp, object); } finally { await rm(temp, { force: true }); }
    }
    files.push({ path, sha256, bytes: bytes.length });
  };
  for (const id of new Set(project.screens.map(screen => screen.documentId))) { identity(id); await add(`documents/${id}.json`, await read(`documents/${id}.json`, limits.state)); }
  for (const screen of project.screens) if (screen.referenceBytes) await add(`references/${screen.id}.png`, await read(`references/${screen.id}.png`, limits.asset));
  for (const asset of project.assets) await add(`assets/${asset.id}`, await read(`assets/${asset.id}`, limits.asset));
  await add("project.json", Buffer.from(JSON.stringify(project)));
  await syncDirectory(storage.objects);
  const index = Buffer.from(JSON.stringify({ version: 1, directory, title: project.title, revision: project.revision, updatedAt: new Date().toISOString(), files }));
  if (index.length > manifestLimit) throw Error("Recovery index exceeds supported project size");
  await syncedWrite(pointer, index, true);
  return { recoveryId: storage.id, recoveryDirectory: storage.home, revision: project.revision };
}
export async function listProjects() {
  const home = await storageHome(), checkpoints = join(home, "checkpoints");
  await secureDirectory(checkpoints);
  const projects = [];
  for (const name of await readdir(checkpoints)) {
    if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
    // Corrupt records remain explicit; never silently report an empty library.
    const record = await manifest(join(checkpoints, name));
    projects.push({ recoveryId: name.slice(0, -5), directory: record.directory, title: record.title, revision: record.revision, updatedAt: record.updatedAt });
  }
  return { directory: home, projects };
}
export async function recoverProject(id, { directory, allowEphemeral = false } = {}) {
  validId(id);
  const home = await storageHome(), source = join(home, "checkpoints");
  await secureDirectory(source); await secureDirectory(join(home, "objects"));
  const record = await manifest(join(source, `${id}.json`));
  const destination = await projectLocation(directory, { title: record.title, allowEphemeral });
  try { await lstat(destination); throw Error("Recovery destination already exists; choose a new directory"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  await secureDirectory(dirname(destination));
  const stage = await mkdtemp(join(dirname(destination), ".app-canvas-recover-"));
  try {
    const buffers = new Map();
    for (const file of record.files) {
      const bytes = await readChecked(join(home, "objects", file.sha256), limits.state);
      if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw Error("Recovery object integrity mismatch");
      buffers.set(file.path, bytes);
      await secureDirectory(join(stage, dirname(file.path))); await syncedWrite(join(stage, file.path), bytes);
    }
    const project = validateProject(JSON.parse(buffers.get("project.json"))), bases = {};
    for (const screen of project.screens) {
      bases[screen.documentId] = validateDocument(JSON.parse(buffers.get(`documents/${screen.documentId}.json`)));
      if (bases[screen.documentId].id !== screen.documentId) throw Error("Recovery document identity mismatch");
      if (screen.referenceBytes) { const bytes = buffers.get(`references/${screen.id}.png`); if (bytes?.length !== screen.referenceBytes || inspectAsset(bytes).mime !== "image/png") throw Error("Recovery reference mismatch"); }
    }
    for (const asset of project.assets) { const verified = inspectAsset(buffers.get(`assets/${asset.id}`)); if (verified.id !== asset.id || verified.mime !== asset.mime) throw Error("Recovery asset mismatch"); }
    if (project.revision !== record.revision) throw Error("Recovery revision mismatch");
    for (const doc of Object.values(bases)) requireAssets(doc, project.assets);
    applyEdits(project, bases);
    for (const folder of ["documents", "assets", "references"]) await secureDirectory(join(stage, folder));
    // Reserve the name without ever replacing a concurrent project's directory.
    await mkdir(destination, { mode: 0o700 });
    try { await rename(stage, destination); await syncDirectory(dirname(destination)); } catch (error) { await rmdir(destination).catch(() => {}); throw error; }
    return { directory: destination, recoveredFrom: id, revision: project.revision };
  } finally { await rm(stage, { recursive: true, force: true }); }
}
