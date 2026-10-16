import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";

export async function bundleNotices(metafile, root) {
  const folders = new Set();
  for (const input of Object.keys(metafile.inputs)) {
    const absolute = resolve(root, input), marker = absolute.lastIndexOf("/node_modules/");
    if (marker === -1) continue;
    const parts = absolute.slice(marker + "/node_modules/".length).split("/");
    folders.add(join(absolute.slice(0, marker), "node_modules", ...parts.slice(0, parts[0].startsWith("@") ? 2 : 1)));
  }
  const notices = [await readFile(join(root, "LICENSE"), "utf8")];
  for (const folder of [...folders].sort()) {
    const pkg = JSON.parse(await readFile(join(folder, "package.json")));
    let license;
    for (const name of ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENSE-MIT", "LICENCE"])
      try { license = await readFile(join(folder, name), "utf8"); break; } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (!license) throw Error(`Missing distribution license: ${pkg.name}`);
    notices.push(`\n--- ${pkg.name} ${pkg.version} ---\n${license}`);
  }
  return notices.join("\n");
}
