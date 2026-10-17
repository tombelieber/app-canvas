import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as inventory from "../lib/inventory.mjs";

async function fixture(t, sources) {
  const root = await mkdtemp(join(tmpdir(), "app-canvas-discovery-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(sources)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

test("discovery finds both native platforms without a hand-selected source-root list", async t => {
  const root = await fixture(t, {
    "ios/Login.swift": 'struct Login { func render() { if denied { showError() } else { showForm() } } }',
    "android/Login.java": 'class Login { void render() { if (denied) showError(); else showForm(); } }',
  });
  assert.equal(typeof inventory.discoverSources, "function", "source discovery is missing");
  const found = await inventory.discoverSources(root);
  assert.deepEqual(found.files.map(file => file.path), ["android/Login.java", "ios/Login.swift"]);
  for (const path of ["android/Login.java", "ios/Login.swift"]) {
    assert.deepEqual(found.obligations.filter(item => item.path === path && item.kind === "branch").map(item => item.outcome).sort(), ["false", "true"]);
  }
});

test("discovery accounts for storyboard scenes, tablet resources and content records", async t => {
  const root = await fixture(t, {
    "ios/Login_iPad.storyboard": '<document><scenes><scene sceneID="first"><objects><viewController id="login"/></objects></scene><scene sceneID="second"><objects><viewController id="replace"/></objects></scene></scenes></document>',
    "android/res/layout-sw600dp/login.xml": '<LinearLayout><TextView android:id="@+id/error"/></LinearLayout>',
    "content/calculators.json": '[{"id":"one"},{"id":"two"}]',
  });
  assert.equal(typeof inventory.discoverSources, "function", "source discovery is missing");
  const found = await inventory.discoverSources(root);
  assert.equal(found.obligations.filter(item => item.kind === "scene").length, 2);
  assert.ok(found.obligations.some(item => item.path.includes("layout-sw600dp") && item.kind === "file"));
  assert.equal(found.obligations.filter(item => item.kind === "record").length, 2);
});

test("comments and string literals cannot invent branches or leak source contents into discovery", async t => {
  const root = await fixture(t, {
    "Login.java": 'class Login { /* if (fake) {} */ String password = "private-example case if else"; void render() { if (denied) showError(); } }',
    "data.json": '{"private-record-key":[{"id":"private-record-value"}]}',
  });
  assert.equal(typeof inventory.discoverSources, "function", "source discovery is missing");
  const found = await inventory.discoverSources(root);
  assert.equal(found.obligations.filter(item => item.kind === "branch").length, 2);
  assert.ok(!JSON.stringify(found).includes("private-example"));
  assert.ok(!JSON.stringify(found).includes("private-record"));
});

test("source review remains required for every part of a large file", async t => {
  const root = await fixture(t, { "Large.m": Array.from({ length: 165 }, (_, i) => `int value${i};`).join("\n") });
  assert.equal(typeof inventory.discoverSources, "function", "source discovery is missing");
  const found = await inventory.discoverSources(root);
  const regions = found.obligations.filter(item => item.kind === "region");
  assert.deepEqual(regions.map(item => [item.start, item.end]), [[1, 80], [81, 160], [161, 165]]);
});

test("unfamiliar source extensions and excluded build directories cannot silently disappear", async t => {
  const root = await fixture(t, {
    "screen.widget": "if failed { render_error() }",
    "build/generated.java": "class Generated {}",
  });
  const found = await inventory.discoverSources(root);
  assert.ok(found.files.some(file => file.path === "screen.widget"));
  assert.ok(found.obligations.some(item => item.kind === "region" && item.path === "screen.widget"));
  assert.ok(found.obligations.some(item => item.kind === "exclusion" && item.path === "build"));
});

test("source symlinks produce an unresolved issue instead of escaping the root", async t => {
  const root = await fixture(t, { "Login.java": "class Login {}" });
  await symlink(join(root, "Login.java"), join(root, "Linked.java"));
  const found = await inventory.discoverSources(root);
  assert.deepEqual(found.issues.map(issue => issue.path), ["Linked.java"]);
});

test("Swift optional type markers are inspection candidates rather than invented true/false states", async t => {
  const root = await fixture(t, { "Login.swift": "struct Login { var error: String?; func render() { if denied { Text(error ?? \"Denied\") } } }" });
  const found = await inventory.discoverSources(root);
  assert.equal(found.obligations.filter(item => item.kind === "branch").length, 2);
});
