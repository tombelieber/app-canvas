import { lstat, realpath } from "node:fs/promises";
import { resolve, dirname, basename, join, relative, isAbsolute } from "node:path";
import { homedir, tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
const exec = promisify(execFile);
export const contains = (parent, child) => { const rel = relative(parent, child); return !rel || rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel); };

// Resolve OS aliases even when the final project directory does not exist yet.
export async function canonicalLocation(path) {
  let current = resolve(path), tail = [];
  for (;;) {
    try { return join(await realpath(current), ...tail); }
    catch (error) { if (error.code !== "ENOENT") throw error; tail.unshift(basename(current)); current = dirname(current); }
  }
}
async function git(path, args) {
  try { return (await exec("git", ["-C", path, ...args], { maxBuffer: 65536 })).stdout.trim(); }
  catch (error) { if (error.code === "ENOENT" || error.code === 128) return undefined; throw error; }
}
export async function locationRisks(path) {
  const target = await canonicalLocation(path), risks = [];
  const temporary = await Promise.all([tmpdir(), "/tmp", "/var/tmp"].map(canonicalLocation));
  if (temporary.some(root => contains(root, target)) || /(?:^|\/)(?:\.artifacts|\.cache|node_modules|\.Trash)(?:\/|$)/.test(target)) risks.push("temporary or disposable directory");
  let existing = target;
  for (;;) { try { if (!(await lstat(existing)).isDirectory()) existing = dirname(existing); break; } catch (error) { if (error.code !== "ENOENT") throw error; existing = dirname(existing); } }
  const repo = await git(existing, ["rev-parse", "--show-toplevel"]);
  if (repo) {
    if ((await lstat(join(repo, ".git"))).isFile()) risks.push("linked Git worktree removed by worktree cleanup");
    try { await exec("git", ["-C", repo, "check-ignore", "--no-index", "--quiet", "--", target]); risks.push("Git-ignored project excluded from snapshots"); }
    catch (error) { if (error.code !== 1) throw error; }
  }
  return { target, risks, repository: repo };
}
export async function storageHome() {
  const configured = process.env.APP_CANVAS_HOME;
  if (configured && !isAbsolute(configured)) throw Error("APP_CANVAS_HOME must be an absolute durable directory");
  const result = await locationRisks(configured || join(homedir(), ".local", "share", "app-canvas"));
  if (result.repository || /(?:^|\/)(?:\.artifacts|\.cache|node_modules|\.Trash)(?:\/|$)/.test(result.target)) throw Error("APP_CANVAS_HOME must be outside Git checkouts and disposable directories");
  return result.target;
}
export async function projectLocation(directory, { title = "project", allowEphemeral = false } = {}) {
  const home = await storageHome();
  if (!directory) return join(home, "projects", `${title.replace(/[^a-z0-9.-]+/gi, "-").slice(0, 80) || "project"}-${randomUUID()}`);
  const { risks } = await locationRisks(directory);
  const target = await canonicalLocation(directory);
  if (contains(target, home) || contains(home, target) && !contains(join(home, "projects"), target)) throw Error("Project must be separate from recovery storage; use its projects directory or another location");
  if (risks.length && !contains(join(home, "projects"), target) && !allowEphemeral) throw Error(`Unsafe project location: ${risks.join("; ")}. Omit --out for durable storage, choose a durable repository-owned path, or explicitly acknowledge --allow-ephemeral (API: allowEphemeral: true). Recovery checkpoints still use APP_CANVAS_HOME.`);
  return target;
}
