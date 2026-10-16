import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
const packs = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf8" }));
const pack = Array.isArray(packs) ? packs[0] : packs["@tombelieber/app-canvas"];
const files = new Set(pack.files.map((f) => f.path));
for (const file of execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean)) files.add(file);
async function collect(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isSymbolicLink()) throw Error(`Symlink in publication: ${file}`);
    if (entry.isDirectory()) await collect(file); else files.add(file);
  }
}
if (process.argv[2]) await collect(process.argv[2]);
const rules = [
  ["personal filesystem path", /\/(?:Users|home)\/[A-Za-z0-9._-]+\//],
  ["OpenAI-style credential", /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}/],
  ["GitHub credential", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["literal bearer credential", /Bearer [A-Za-z0-9._-]{25,}/],
];
const failures = [];
for (const file of files) {
  if (/(^|\/)(?:\.env[^/]*|measurement-guide|\.git|\.artifacts\/privacy-review)(\/|$)|\.(?:pem|key|sqlite|db|map)$/.test(file)) failures.push(`${file}: forbidden publication file`);
  const buffer = await readFile(file);
  if (/\.(?:png|jpg|jpeg|webp|gif)$/.test(file)) continue;
  const text = buffer.toString("utf8");
  for (const [name, rule] of rules) if (rule.test(text)) failures.push(`${file}: ${name}`);
  // Existing public copyright attribution is retained. App fixtures may only
  // use reserved example domains, never a maintainer's contact address.
  if (!/LICENSE|notices\//i.test(file))
    for (const email of text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
      if (!/@(?:example\.(?:test|com|org|net)|users\.noreply\.github\.com)$/i.test(email)) failures.push(`${file}: non-example email`);
}
if (failures.length) throw Error(failures.join("\n"));
console.log(`PASS: ${files.size} package/static files checked for private paths, contact addresses, common credentials and forbidden artifacts. Manual data/image review is still required.`);
