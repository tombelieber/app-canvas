import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, symlink, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { captureFixture } from "./fixtures/import-model.mjs";
const { createStore } = await import("../lib/import/store.mjs").catch(() => ({}));
async function setup(t) {
  assert.equal(typeof createStore, "function", "atomic import store must exist");
  const root = await mkdtemp(join(tmpdir(), "app-canvas-import-test-")); t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "project"), store = await createStore(path, { create: true }); return { root, path, store };
}
test("capture, edit save and reopen preserve history and reject stale writers", async t => {
  const { path, store } = await setup(t);
  const saved = await store.capture(captureFixture()); assert.equal(saved.project.screens.length, 1);
  const id = saved.project.screens[0].id;
  const history = [{ type: "setText", screenId: id, layerId: "n3", value: "Saved alternative" }];
  await store.save({ expectedRevision: saved.project.revision, history, cursor: 1 });
  const reopened = await (await createStore(path)).read();
  assert.equal(reopened.documents[id].root.children[0].children[0].text, "Saved alternative");
  assert.equal(reopened.project.history.length, 1);
  await assert.rejects(() => store.save({ expectedRevision: saved.project.revision, history: [], cursor: 0 }), /revision|conflict/i);
  assert.equal(JSON.parse(await readFile(join(path, "project.json"))).history.length, 1);
  await assert.rejects(() => createStore(path, { create: true }), /exist/i);
});
test("duplicate captures keep observations without inventing transitions", async t => {
  const { store } = await setup(t);
  await store.capture(captureFixture("first"));
  await store.capture(captureFixture("second"));
  const { project } = await store.read(); assert.equal(project.screens.length, 1); assert.equal(project.observations.length, 2); assert.equal(project.flows.length, 0);
  const changed = captureFixture("third"); changed.document.root.children[0].children[0].text = "Menu open";
  changed.source.trigger = { id: "action-a", type: "click", label: "Open menu" };
  const next = await store.capture(changed); assert.equal(next.project.screens.length, 2); assert.equal(next.project.flows[0].label, "Open menu");
});
test("project reads and writes reject symlink escapes and corrupt saved operations", async t => {
  const { root, path, store } = await setup(t); await store.capture(captureFixture());
  const project = JSON.parse(await readFile(join(path, "project.json")));
  project.screens[0].documentId = "../../outside"; await writeFile(join(path, "project.json"), JSON.stringify(project));
  await assert.rejects(() => store.read(), /document|identity|id|path/i);
  const evil = join(root, "evil"); await mkdir(evil); await symlink(path, join(evil, "linked"));
  await assert.rejects(() => createStore(join(evil, "linked")), /symlink/i);
});
test("missing local assets fail closed before a capture becomes durable", async t => {
  const { store } = await setup(t), capture = captureFixture();
  capture.document.root.children[1].style["background-image"] = `url("asset:${"a".repeat(64)}")`;
  await assert.rejects(() => store.capture(capture), /missing.*asset/i);
  assert.equal((await store.metadata()).screens.length, 0);
});
