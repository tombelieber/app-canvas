import { mkdir, readdir, lstat, realpath, writeFile, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

export async function prepareCaptureProfile(path, directory) {
  const profile = resolve(path), project = resolve(directory);
  const contains = (a, b) => { const rel = relative(a, b); return !rel || !rel.startsWith("..") && !rel.startsWith("/"); };
  if (contains(project, profile) || contains(profile, project)) throw Error("Capture profile must be separate from the exported project");
  await mkdir(profile, { recursive: true, mode: 0o700 });
  if ((await lstat(profile)).isSymbolicLink() || await realpath(profile) !== profile) throw Error("Capture profile must use its canonical directory");
  const marker = `${profile}/.app-canvas-profile`, entries = await readdir(profile);
  if (entries.length) {
    if (!entries.includes(".app-canvas-profile") || (await lstat(marker)).isSymbolicLink() || await readFile(marker, "utf8") !== "app-canvas-dedicated-profile-v1\n") throw Error("Use an empty or Agent Canvas dedicated profile; daily browser profiles are unsupported");
  } else await writeFile(marker, "app-canvas-dedicated-profile-v1\n", { flag: "wx", mode: 0o600 });
  return profile;
}
