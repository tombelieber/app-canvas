import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { loadContent } from "../launch/content.mjs";
import { syncReadmes } from "../launch/readmes.mjs";
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
const marketplace = JSON.parse(await readFile(".claude-plugin/marketplace.json"));
if (marketplace.name !== plugin.name || marketplace.plugins.length !== 1 ||
    marketplace.plugins[0].name !== plugin.name || marketplace.plugins[0].source !== "./")
  throw Error("Standalone marketplace must resolve the local App Canvas plugin");
for (const file of ["README.md", "AGENT_GUIDE.md", "skills/app-canvas/SKILL.md"])
  if (!(await readFile(file, "utf8")).includes(`github:tombelieber/app-canvas#v${p.version}`))
    throw Error(`${file} must pin the current App Canvas release`);
await syncReadmes(await loadContent(), true);
