import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSourceCoverage, discoverSources } from "../lib/inventory.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "app-canvas-population-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, ".artifacts"));
  await writeFile(join(root, "Login.java"), 'class Login { void render() { if (denied) setText("Denied"); else setText("Login"); } }');
  const discovery = await discoverSources(root);
  const inventory = {
    ...discovery,
    items: [
      { id: "login", kind: "screen", sources: ["Login.java"], cases: ["idle"] },
      { id: "denied", kind: "state", sources: ["Login.java"], cases: ["denied"] },
    ],
    reviews: discovery.obligations.map(item => item.kind === "exclusion" ? { id: item.id, nonUiReason: "App Canvas generated worklist output" } : { id: item.id, items: [item.outcome === "true" ? "denied" : "login"] }),
  };
  const project = { catalog: [{ id: "idle" }, { id: "denied" }], coverage: { requireSourceInventory: true }, sourceCoverage: { roots: ["."], inventory: ".artifacts/inventory.json" } };
  async function check() {
    await writeFile(join(root, ".artifacts/inventory.json"), JSON.stringify(inventory));
    return checkSourceCoverage(project, root, { complete: true });
  }
  return { root, inventory, project, check };
}

test("omitting a state from both inventory and catalog cannot erase a source branch", async t => {
  const f = await fixture(t);
  await f.check();
  f.project.catalog.pop();
  f.inventory.items.pop();
  f.inventory.reviews = f.inventory.reviews.filter(review => !review.items?.includes("denied"));
  await assert.rejects(f.check, /unreviewed|unresolved|missing.*obligation/i);
});

test("a source file outside the agent's selected roots remains part of discovery", async t => {
  const f = await fixture(t);
  await f.check();
  f.project.sourceCoverage.roots = ["Login.java"];
  await writeFile(join(f.root, "Tablet.swift"), "struct Tablet {}\n");
  await assert.rejects(f.check, /changed.*Tablet\.swift/i);
});

test("opposite UI branch outcomes cannot both be represented by the same case", async t => {
  const f = await fixture(t);
  for (const review of f.inventory.reviews) if (review.items) review.items = ["login"];
  await assert.rejects(f.check, /opposite|same.*case/i);
});

test("a rendering branch cannot be dismissed with a non-UI reason", async t => {
  const f = await fixture(t);
  const branch = f.inventory.obligations.find(item => item.kind === "branch");
  const review = f.inventory.reviews.find(item => item.id === branch.id);
  delete review.items;
  review.nonUiReason = "Not convenient to capture";
  await assert.rejects(f.check, /rendering.*non.UI|non.UI.*rendering/i);
});

test("complete validation refuses the legacy self-authored denominator", async t => {
  const f = await fixture(t);
  f.inventory.version = 1;
  await assert.rejects(f.check, /version 2|discovery/i);
});

test("declared target platforms reach runtime evidence requirements", async t => {
  const f = await fixture(t);
  for (const item of f.inventory.items) item.platform = "android";
  const report = await f.check();
  assert.ok(report.requiredEvidence.idle.every(item => item.platform === "android"));
});
