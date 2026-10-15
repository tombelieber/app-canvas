import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
for (const folder of ["bin", "lib", "scripts", "tests"])
  for (const file of await readdir(folder))
    if (/\.(m?js)$/.test(file)) {
      const r = spawnSync(process.execPath, ["--check", `${folder}/${file}`], {
        stdio: "inherit",
      });
      if (r.status) process.exit(r.status);
    }
const p = JSON.parse(await readFile("package.json"));
const plugin = JSON.parse(await readFile(".claude-plugin/plugin.json"));
if (p.version !== plugin.version)
  throw Error("Plugin/package version mismatch");
