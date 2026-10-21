import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = fileURLToPath(new URL("..", import.meta.url));
const { values } = parseArgs({ options: { out: { type: "string" } } });
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const tag = `v${pkg.version}`;
if (process.env.RELEASE_TAG && process.env.RELEASE_TAG !== tag)
  throw Error(`Release tag ${process.env.RELEASE_TAG} does not match ${tag}`);
const changelog = await readFile(join(root, "CHANGELOG.md"), "utf8");
const heading = `## ${pkg.version}\n`;
if (!changelog.includes(heading)) throw Error(`Missing changelog entry for ${tag}`);
const notes = changelog.split(heading)[1].split(/^## /m)[0].trim();
if (!notes) throw Error(`Empty changelog entry for ${tag}`);

// A fresh directory prevents an older archive from entering this release.
const output = resolve(root, values.out || ".artifacts/release");
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
const packs = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", output], {
  cwd: root, encoding: "utf8",
}));
const pack = Array.isArray(packs) ? packs[0] : packs[pkg.name];
if (pack?.version !== pkg.version) throw Error("Packed version does not match the release");
const files = new Set(pack.files.map(file => file.path));
for (const required of [
  "bin/app-canvas.mjs", ".claude-plugin/plugin.json", ".claude-plugin/marketplace.json",
  "skills/app-canvas/SKILL.md", "skills/app-canvas/agents/openai.yaml",
  "skills/app-canvas/references/completion.md", "skills/app-canvas/references/native.md",
  "skills/app-canvas/references/source-audit.md", "skills/app-canvas/references/population.md",
  "lib/populate.mjs", "lib/ui-coverage.mjs",
  "lib/import/agent.mjs", "lib/import/agent-cli.mjs", "lib/import/reader.mjs",
  "skills/app-canvas/references/url-import.md", "docs/url-import.md",
  "AGENT_GUIDE.md", "CHANGELOG.md",
  "lib/import/export.mjs", "docs/self-hosted-review.md",
  "skills/app-canvas/references/sharing.md",
]) if (!files.has(required)) throw Error(`Release package missing ${required}`);
const sha256 = createHash("sha256").update(await readFile(join(output, pack.filename))).digest("hex");
await writeFile(join(output, "SHA256SUMS"), `${sha256}  ${pack.filename}\n`);
await writeFile(join(output, "release-notes.md"), `${notes}\n`);
console.log(JSON.stringify({ tag, filename: pack.filename, sha256 }, null, 2));
