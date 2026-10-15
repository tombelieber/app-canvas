import {
  readFile,
  mkdir,
  writeFile,
  cp,
  lstat,
  symlink,
  readlink,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
const root = fileURLToPath(new URL("..", import.meta.url));
async function exists(path) {
  try {
    return await lstat(path);
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
async function filesAt(root, base = root) {
  const files = {};
  for (const item of await readdir(root, { withFileTypes: true })) {
    if (item.name === ".app-canvas-managed.json") continue;
    const path = join(root, item.name);
    if (item.isDirectory()) Object.assign(files, await filesAt(path, base));
    else if (item.isFile())
      files[relative(base, path)] = createHash("sha256")
        .update(await readFile(path))
        .digest("hex");
    else throw Error(`Unexpected skill link: ${path}`);
  }
  return files;
}
export async function install({
  target = "both",
  home = homedir(),
  linkCli = true,
} = {}) {
  if (!["codex", "claude", "both"].includes(target))
    throw Error("Target must be codex, claude or both");
  const destinations = (target === "both" ? ["codex", "claude"] : [target]).map(
    (tool) => join(home, `.${tool}`, "skills/app-canvas"),
  );
  // Preflight every destination before updating either harness.
  for (const destination of destinations) {
    const info = await exists(destination);
    if (!info) continue;
    let managed;
    try {
      managed = JSON.parse(
        await readFile(join(destination, ".app-canvas-managed.json")),
      );
    } catch {}
    if (info.isSymbolicLink() || managed?.package !== "@tombelieber/app-canvas")
      throw Error(`Existing unmanaged skill: ${destination}`);
    const unchanged = managed.files
      ? JSON.stringify(await filesAt(destination)) ===
        JSON.stringify(managed.files)
      : (await readFile(join(destination, "SKILL.md"), "utf8")) ===
        managed.skill;
    if (!unchanged)
      throw Error(
        `Locally edited skill; preserve before updating: ${destination}`,
      );
  }
  const link = join(home, ".local/bin/app-canvas"),
    source = join(root, "bin/app-canvas.mjs");
  let oldLink;
  if (linkCli && (await exists(link))) {
    const info = await lstat(link);
    if (!info.isSymbolicLink()) throw Error(`Existing CLI at ${link}`);
    oldLink = await readlink(link);
    const oldSource = resolve(dirname(link), oldLink);
    if (oldSource !== source) {
      let oldPackage;
      try {
        oldPackage = JSON.parse(
          await readFile(resolve(dirname(oldSource), "../package.json")),
        );
      } catch {}
      if (
        oldPackage?.name !== "@tombelieber/app-canvas" ||
        !oldSource.endsWith("/bin/app-canvas.mjs")
      )
        throw Error(`Existing unmanaged CLI at ${link}`);
    }
  }
  for (const destination of destinations) {
    await mkdir(destination, { recursive: true });
    await cp(join(root, "skills/app-canvas"), destination, { recursive: true });
    await writeFile(
      join(destination, ".app-canvas-managed.json"),
      JSON.stringify(
        {
          package: "@tombelieber/app-canvas",
          files: await filesAt(destination),
        },
        null,
        2,
      ),
    );
  }
  if (linkCli && oldLink !== source) {
    await mkdir(dirname(link), { recursive: true });
    const temporary = `${link}-${randomUUID()}`;
    try {
      await symlink(source, temporary);
      await rename(temporary, link);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  console.log(
    `Installed App Canvas skill for ${target}; shared CLI available as app-canvas.`,
  );
  return destinations;
}
