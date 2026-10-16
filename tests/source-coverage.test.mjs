import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadProject } from "../lib/config.mjs";
import { publicProject } from "../lib/protocol.mjs";
const exec = promisify(execFile);

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "app-canvas-source-coverage-"));
  t.after(() => rm(root, { recursive: true }));
  await mkdir(join(root, "native"));
  const source = "class LoginController { /* idle and denied UI */ }\n";
  await writeFile(join(root, "native/Login.swift"), source);
  const inventory = {
    version: 1,
    files: [{ path: "native/Login.swift", sha256: createHash("sha256").update(source).digest("hex") }],
    items: [
      { id: "login", kind: "screen", sources: ["native/Login.swift"], cases: ["idle"] },
      { id: "login-denied", kind: "state", sources: ["native/Login.swift"], cases: ["denied"] },
    ],
  };
  const project = {
    title: "Native inventory", groups: [{ id: "app" }],
    catalog: [
      { id: "idle", title: "Login", group: "app" },
      { id: "denied", title: "Denied", group: "app" },
    ],
    coverage: { requireSourceInventory: true },
    sourceCoverage: { roots: ["native"], inventory: "inventory.json" },
  };
  const load = async () => {
    await writeFile(join(root, "inventory.json"), JSON.stringify(inventory));
    await writeFile(join(root, "canvas.config.mjs"), `export default ${JSON.stringify(project)}`);
    return loadProject("canvas.config.mjs", root);
  };
  return { root, inventory, project, load };
}

test("a source inventory accounts for screens, component variants and non-UI support files", async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.root, "native/Transport.swift"), "// synthetic transport boundary\n");
  f.inventory.files.push({ path: "native/Transport.swift", sha256: createHash("sha256").update("// synthetic transport boundary\n").digest("hex"), nonUiReason: "Transport has no rendered UI; its error state is exercised in Login." });
  f.inventory.items.push({ id: "submit-disabled", kind: "component", sources: ["native/Login.swift"], cases: ["idle"] });
  const loaded = await f.load();
  assert.deepEqual(loaded.sourceCoverageReport, { files: 2, items: 3, cases: 2 });
  assert.equal(publicProject(loaded).sourceCoverage, undefined);
  assert.equal(publicProject(loaded).sourceCoverageReport, undefined);
});

test("a catalog-only success cannot pass when the complete-inventory gate is required", async (t) => {
  const f = await fixture(t);
  delete f.project.sourceCoverage;
  await assert.rejects(f.load, /source inventory.*required/i);
});

test("a source-discovered state cannot disappear by being omitted from the catalog", async (t) => {
  const f = await fixture(t);
  f.project.catalog.pop();
  await assert.rejects(f.load, /login-denied.*denied/i);
});

test("blocked and unmapped states remain failures even when every registered viewer case passes", async (t) => {
  const f = await fixture(t);
  f.inventory.items[1].cases = [];
  f.inventory.items[1].blocker = "No disposable device slot available";
  await assert.rejects(f.load, /login-denied.*device slot/i);
  delete f.inventory.items[1].blocker;
  await assert.rejects(f.load, /login-denied.*case/i);
});

test("new, changed and removed source files invalidate the reviewed inventory", async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.root, "native/Tablet.swift"), "class TabletController {}\n");
  await assert.rejects(f.load, /inventory.*changed.*Tablet\.swift/i);
  await rm(join(f.root, "native/Tablet.swift"));
  await writeFile(join(f.root, "native/Login.swift"), "class LoginController { /* new loading state */ }\n");
  await assert.rejects(f.load, /inventory.*changed.*Login\.swift/i);
  await rm(join(f.root, "native/Login.swift"));
  await assert.rejects(f.load, /inventory.*changed.*Login\.swift/i);
});

test("every scanned UI file and every catalog case needs an inventory mapping", async (t) => {
  const f = await fixture(t);
  f.inventory.items = [];
  await assert.rejects(f.load, /inventory.*items/i);
  f.inventory.items = [{ id: "denied", kind: "state", sources: ["native/Login.swift"], cases: ["denied"] }];
  await assert.rejects(f.load, /catalog.*idle/i);
  f.inventory.items[0].sources = [];
  await assert.rejects(f.load, /denied.*source/i);
});

test("duplicate IDs, unknown source references and empty roots cannot weaken the gate", async (t) => {
  const f = await fixture(t);
  f.inventory.items[1].id = "login";
  await assert.rejects(f.load, /duplicate.*login/i);
  f.inventory.items[1].id = "login-denied";
  f.inventory.items[1].sources = ["not-scanned.swift"];
  await assert.rejects(f.load, /source.*not-scanned/i);
  f.project.sourceCoverage.roots = [];
  await assert.rejects(f.load, /roots/i);
});

test("an empty or non-UI inventory cannot silently claim complete UI coverage", async (t) => {
  const f = await fixture(t);
  f.inventory.files[0].nonUiReason = "Everything is out of scope";
  await assert.rejects(f.load, /non.UI.*Login\.swift/i);
  f.inventory.files = [];
  await assert.rejects(f.load, /inventory.*changed/i);
});

test("a newly reviewed file still needs semantic UI accounting after fingerprints are updated", async (t) => {
  const f = await fixture(t), source = "class TabletController {}\n";
  await writeFile(join(f.root, "native/Tablet.swift"), source);
  f.inventory.files.push({ path: "native/Tablet.swift", sha256: createHash("sha256").update(source).digest("hex") });
  await assert.rejects(f.load, /UI sources missing.*Tablet\.swift/i);
});

test("the actual CLI check runs the source gate and reports a missing state as failure", async (t) => {
  const f = await fixture(t);
  await f.load();
  const cli = fileURLToPath(new URL("../bin/app-canvas.mjs", import.meta.url));
  const result = await exec(process.execPath, [cli, "--config", "canvas.config.mjs", "--check"], { cwd: f.root });
  assert.match(result.stdout, /2 source inventory items mapped/);
  f.project.catalog.pop();
  await assert.rejects(f.load, /login-denied/);
  await assert.rejects(
    () => exec(process.execPath, [cli, "--config", "canvas.config.mjs", "--check"], { cwd: f.root }),
    error => error.code === 1 && /login-denied.*denied/.test(error.stderr),
  );
});
