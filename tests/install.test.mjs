import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { install } from "../lib/install.mjs";
test("one installer keeps both harness skills identical and preserves local edits", async () => {
  const home = await mkdtemp(join(tmpdir(), "app-canvas-install-"));
  try {
    const paths = await install({ home });
    assert.equal(paths.length, 2);
    const [a, b] = await Promise.all(
      paths.map((p) => readFile(join(p, "SKILL.md"), "utf8")),
    );
    assert.equal(a, b);
    // The native and completion contracts must survive a copied skill install;
    // links into the maintainer's checkout cannot serve installed agents.
    for (const name of ["completion.md", "native.md", "population.md", "source-audit.md", "url-import.md", "sharing.md"]) {
      const copies = await Promise.all(paths.map(p => readFile(join(p, "references", name), "utf8")));
      assert.equal(copies[0], copies[1]);
      assert.ok(copies[0].length > 0);
    }
    await install({ home });
    const agentFile = join(paths[1], "agents/openai.yaml");
    const agent = await readFile(agentFile, "utf8");
    const referenceFile = join(paths[1], "references/native.md");
    const reference = await readFile(referenceFile, "utf8");
    await writeFile(referenceFile, reference + "\nLocal native workflow\n");
    await assert.rejects(() => install({ home }), /Locally edited/);
    await writeFile(referenceFile, reference);
    await writeFile(agentFile, agent + "\n# Local setting\n");
    await assert.rejects(() => install({ home }), /Locally edited/);
    await writeFile(agentFile, agent);
    await writeFile(join(paths[0], "SKILL.md"), a + "\nLocal change\n");
    await assert.rejects(() => install({ home }), /Locally edited/);
  } finally {
    await rm(home, { recursive: true });
  }
});

test("rebrand migrates unchanged managed legacy skills and keeps both CLI commands", async t => {
  const { cp, mkdir, readdir, symlink, readlink, stat } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const { relative } = await import("node:path");
  const home = await mkdtemp(join(tmpdir(), "agent-canvas-upgrade-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const oldPackage = join(home, "old-package");
  await mkdir(join(oldPackage, "bin"), { recursive: true });
  await writeFile(join(oldPackage, "package.json"), JSON.stringify({ name: "@tombelieber/app-canvas" }));
  await writeFile(join(oldPackage, "bin/app-canvas.mjs"), "// previous published command\n");
  await mkdir(join(home, ".local/bin"), { recursive: true });
  await symlink(join(oldPackage, "bin/app-canvas.mjs"), join(home, ".local/bin/app-canvas"));
  const hashTree = async (directory, base = directory) => {
    const files = {};
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) Object.assign(files, await hashTree(path, base));
      else files[relative(base, path)] = createHash("sha256").update(await readFile(path)).digest("hex");
    }
    return files;
  };
  for (const harness of ["codex", "claude"]) {
    const legacy = join(home, `.${harness}/skills/app-canvas`);
    await cp(new URL("../skills/agent-canvas", import.meta.url), legacy, { recursive: true });
    await writeFile(join(legacy, ".app-canvas-managed.json"), JSON.stringify({ package: "@tombelieber/app-canvas", files: await hashTree(legacy) }));
  }
  const paths = await install({ home });
  for (const [index, harness] of ["codex", "claude"].entries()) {
    assert.equal(paths[index], join(home, `.${harness}/skills/agent-canvas`));
    assert.match(await readFile(join(paths[index], "SKILL.md"), "utf8"), /name: agent-canvas/);
    await assert.rejects(() => stat(join(home, `.${harness}/skills/app-canvas`)), { code: "ENOENT" });
    assert.equal(JSON.parse(await readFile(join(paths[index], ".app-canvas-managed.json"))).package, "@tombelieber/agent-canvas");
  }
  for (const name of ["agent-canvas", "app-canvas"]) assert.ok((await readlink(join(home, ".local/bin", name))).endsWith(`/bin/${name}.mjs`));
  await install({ home });
});

test("a locally edited legacy skill prevents changes to either harness", async t => {
  const { mkdir, stat } = await import("node:fs/promises");
  const home = await mkdtemp(join(tmpdir(), "agent-canvas-edited-legacy-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const legacy = join(home, ".claude/skills/app-canvas");
  await mkdir(legacy, { recursive: true });
  await writeFile(join(legacy, "SKILL.md"), "My edited previous skill\n");
  await writeFile(join(legacy, ".app-canvas-managed.json"), JSON.stringify({ package: "@tombelieber/app-canvas", skill: "Original previous skill\n" }));
  await assert.rejects(() => install({ home }), /Locally edited skill/);
  assert.equal(await readFile(join(legacy, "SKILL.md"), "utf8"), "My edited previous skill\n");
  await assert.rejects(() => stat(join(home, ".codex/skills/agent-canvas")), { code: "ENOENT" });
  await assert.rejects(() => stat(join(home, ".local/bin/agent-canvas")), { code: "ENOENT" });
});

test("unmanaged legacy skill and CLI collisions fail before canonical installation", async t => {
  const { mkdir, stat } = await import("node:fs/promises");
  const home = await mkdtemp(join(tmpdir(), "agent-canvas-collisions-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const legacy = join(home, ".codex/skills/app-canvas");
  await mkdir(legacy, { recursive: true });
  await writeFile(join(legacy, "SKILL.md"), "Unmanaged user skill");
  await assert.rejects(() => install({ home }), /Existing unmanaged skill/);
  assert.equal(await readFile(join(legacy, "SKILL.md"), "utf8"), "Unmanaged user skill");
  await rm(legacy, { recursive: true });
  await mkdir(join(home, ".local/bin"), { recursive: true });
  await writeFile(join(home, ".local/bin/app-canvas"), "User-owned command");
  await assert.rejects(() => install({ home }), /Existing CLI/);
  assert.equal(await readFile(join(home, ".local/bin/app-canvas"), "utf8"), "User-owned command");
  await assert.rejects(() => stat(join(home, ".codex/skills/agent-canvas")), { code: "ENOENT" });
});
