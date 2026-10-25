import { readFile, mkdir, writeFile, cp, lstat, symlink, readlink, readdir, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";

const root = fileURLToPath(new URL("..", import.meta.url));
// Preserve the marker format so pre-rebrand installations can be upgraded safely.
const marker = ".app-canvas-managed.json";
const packages = new Set(["@tombelieber/app-canvas", "@tombelieber/agent-canvas"]);
async function exists(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
async function filesAt(directory, base = directory) {
  const files = {};
  for (const item of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (item.name === marker) continue;
    const path = join(directory, item.name);
    if (item.isDirectory()) Object.assign(files, await filesAt(path, base));
    else if (item.isFile()) files[relative(base, path)] = createHash("sha256").update(await readFile(path)).digest("hex");
    else throw Error(`Unexpected skill link: ${path}`);
  }
  return files;
}
function sameFiles(a, b) {
  const keys = Object.keys(a).sort();
  return JSON.stringify(keys) === JSON.stringify(Object.keys(b).sort()) && keys.every(key => a[key] === b[key]);
}
async function inspectSkill(destination) {
  const info = await exists(destination);
  if (!info) return false;
  let managed;
  try { managed = JSON.parse(await readFile(join(destination, marker), "utf8")); } catch {}
  if (!info.isDirectory() || info.isSymbolicLink() || !packages.has(managed?.package))
    throw Error(`Existing unmanaged skill: ${destination}`);
  const unchanged = managed.files
    ? sameFiles(await filesAt(destination), managed.files)
    : (await readFile(join(destination, "SKILL.md"), "utf8")) === managed.skill;
  if (!unchanged) throw Error(`Locally edited skill; preserve before updating: ${destination}`);
  return true;
}
async function inspectCli(link, source) {
  const info = await exists(link);
  if (!info) return undefined;
  if (!info.isSymbolicLink()) throw Error(`Existing CLI at ${link}`);
  const previous = await readlink(link);
  const oldSource = resolve(dirname(link), previous);
  if (oldSource === source) return previous;
  let oldPackage;
  try { oldPackage = JSON.parse(await readFile(resolve(dirname(oldSource), "../package.json"), "utf8")); } catch {}
  if (!packages.has(oldPackage?.name) || !/\/bin\/(?:app|agent)-canvas\.mjs$/.test(oldSource))
    throw Error(`Existing unmanaged CLI at ${link}`);
  return previous;
}
async function replaceLink(link, source) {
  await mkdir(dirname(link), { recursive: true });
  const temporary = `${link}-${randomUUID()}`;
  try { await symlink(source, temporary); await rename(temporary, link); }
  finally { await rm(temporary, { force: true }); }
}

export async function install({ target = "both", home = homedir(), linkCli = true } = {}) {
  if (!["codex", "claude", "both"].includes(target)) throw Error("Target must be codex, claude or both");
  const plans = (target === "both" ? ["codex", "claude"] : [target]).map(tool => ({
    destination: join(home, `.${tool}`, "skills/agent-canvas"),
    legacy: join(home, `.${tool}`, "skills/app-canvas"),
  }));
  // Inspect BOTH harnesses, both skill names and BOTH CLI links before any writes.
  for (const plan of plans) {
    plan.existed = await inspectSkill(plan.destination);
    plan.migrate = await inspectSkill(plan.legacy);
  }
  const links = linkCli ? ["agent-canvas", "app-canvas"].map(name => ({
    link: join(home, ".local/bin", name), source: join(root, "bin", `${name}.mjs`),
  })) : [];
  for (const plan of links) plan.previous = await inspectCli(plan.link, plan.source);
  const transaction = randomUUID();
  try {
    // Stage full copies first. No harness can receive a half-copied skill.
    for (const plan of plans) {
      await mkdir(dirname(plan.destination), { recursive: true });
      plan.staging = `${plan.destination}-${transaction}.tmp`;
      plan.backup = `${plan.destination}-${transaction}.bak`;
      await cp(join(root, "skills/agent-canvas"), plan.staging, { recursive: true });
      await writeFile(join(plan.staging, marker), JSON.stringify({
        package: "@tombelieber/agent-canvas", files: await filesAt(plan.staging),
      }, null, 2) + "\n");
    }
    for (const plan of plans) {
      if (plan.existed) { await rename(plan.destination, plan.backup); plan.backedUp = true; }
      await rename(plan.staging, plan.destination); plan.installed = true;
    }
    for (const plan of links) {
      if (plan.previous !== plan.source) { await replaceLink(plan.link, plan.source); plan.changed = true; }
    }
  } catch (error) {
    for (const plan of links.toReversed()) if (plan.changed) {
      if (plan.previous === undefined) await rm(plan.link, { force: true });
      else await replaceLink(plan.link, plan.previous);
    }
    for (const plan of plans.toReversed()) {
      if (plan.installed) await rm(plan.destination, { recursive: true, force: true });
      if (plan.backedUp) await rename(plan.backup, plan.destination);
    }
    throw error;
  } finally {
    for (const plan of plans) if (plan.staging) await rm(plan.staging, { recursive: true, force: true });
  }
  // All canonical skills and aliases are now installed. Retire only preflighted,
  // unchanged managed legacy skills; user-owned files never reach this cleanup.
  for (const plan of plans) if (plan.migrate) await inspectSkill(plan.legacy);
  for (const plan of plans) {
    if (plan.migrate) await rm(plan.legacy, { recursive: true });
    if (plan.backedUp) await rm(plan.backup, { recursive: true });
  }
  console.log(`Installed Agent Canvas skill for ${target}; CLI: agent-canvas (app-canvas alias supported).`);
  return plans.map(plan => plan.destination);
}
