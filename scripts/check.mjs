import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
async function checkFolder(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = `${folder}/${entry.name}`;
    if (entry.isDirectory()) await checkFolder(path);
    else if (/\.(m?js)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ["--check", path], { stdio: "inherit" });
      if (result.status) process.exit(result.status);
    }
  }
}
for (const folder of ["bin", "lib", "scripts", "tests", "ui"]) await checkFolder(folder);
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
