import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProject } from "../lib/config.mjs";
test("two apps in the same repository have independent compiled config caches", async () => {
  const root = await mkdtemp(join(tmpdir(), "app-canvas-config-"));
  try {
    const make = (title) =>
      `export default ${JSON.stringify({ title, groups: [{ id: "app" }], catalog: [{ id: "home", group: "app", title: "Home" }] })}`;
    await writeFile(join(root, "a.mjs"), make("Web"));
    await writeFile(join(root, "b.mjs"), make("Admin"));
    const [a, b] = await Promise.all(
      ["a.mjs", "b.mjs"].map((path) => loadProject(path, root)),
    );
    assert.deepEqual([a.title, b.title], ["Web", "Admin"]);
  } finally {
    await rm(root, { recursive: true });
  }
});
