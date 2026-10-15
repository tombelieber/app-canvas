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
    await install({ home });
    const agentFile = join(paths[1], "agents/openai.yaml");
    const agent = await readFile(agentFile, "utf8");
    await writeFile(agentFile, agent + "\n# Local setting\n");
    await assert.rejects(() => install({ home }), /Locally edited/);
    await writeFile(agentFile, agent);
    await writeFile(join(paths[0], "SKILL.md"), a + "\nLocal change\n");
    await assert.rejects(() => install({ home }), /Locally edited/);
  } finally {
    await rm(home, { recursive: true });
  }
});
