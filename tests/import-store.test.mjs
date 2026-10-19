import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, symlink, mkdir, rm, readdir } from "node:fs/promises";
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
test("a full desktop landscape persists up to 512 screens and rejects overflow before writing resources", async t => {
  const { path, store } = await setup(t);
  await store.capture(captureFixture());
  const seeded = JSON.parse(await readFile(join(path, "project.json")));
  const first = seeded.screens[0];
  for (let i = 1; i < 511; i++) {
    const capture = captureFixture(`doc-${i}`); capture.document.root.children[0].children[0].text = `Screen ${i}`;
    await writeFile(join(path, "documents", `doc-${i}.json`), JSON.stringify(capture.document));
    seeded.screens.push({ ...first, id: `screen-${i}`, documentId: `doc-${i}`, fingerprint: `fixture-${i}` });
  }
  await writeFile(join(path, "project.json"), JSON.stringify(seeded));
  const last = captureFixture("doc-511"); last.document.root.children[0].children[0].text = "Screen 511";
  await store.capture(last);
  assert.equal((await (await createStore(path)).read()).project.screens.length, 512);
  const before = await readdir(join(path, "documents"));
  const overflow = captureFixture("overflow"); overflow.document.root.children[0].children[0].text = "Overflow";
  await assert.rejects(() => store.capture(overflow), /limit|size/i);
  assert.deepEqual(await readdir(join(path, "documents")), before, "rejected capture leaves no orphan document");
  assert.equal((await store.metadata()).screens.length, 512);
});
test("capture reserves capacity for saved redo alternatives before writing a document", async t => {
  const { path, store } = await setup(t); await store.capture(captureFixture());
  const project = JSON.parse(await readFile(join(path, "project.json")));
  project.screens = Array.from({ length: 511 }, (_, i) => ({ ...project.screens[0], id: `screen-${i}` }));
  project.observations = [];
  project.history = [{ type: "duplicateScreen", screenId: "screen-0", newId: "alternative", value: "Alternative" }];
  project.cursor = 0;
  await writeFile(join(path, "project.json"), JSON.stringify(project));
  const before = await readdir(join(path, "documents")), capture = captureFixture("overflow");
  capture.document.root.children[0].children[0].text = "New capture";
  await assert.rejects(() => store.capture(capture), /limit/i);
  assert.deepEqual(await readdir(join(path, "documents")), before);
  assert.equal((await store.read()).project.screens.length, 511);
});
test("observation overflow retains accepted captures without orphan resources", async t => {
  const { path, store } = await setup(t); await store.capture(captureFixture());
  const project = JSON.parse(await readFile(join(path, "project.json")));
  project.observations = Array.from({ length: 1024 }, (_, i) => ({ id: `observation-${i}`, screenId: project.screens[0].id, reason: "manual" }));
  await writeFile(join(path, "project.json"), JSON.stringify(project));
  const before = await readdir(join(path, "documents")), capture = captureFixture("overflow");
  capture.document.root.children[0].children[0].text = "New capture";
  await assert.rejects(() => store.capture(capture), /observation limit/i);
  assert.deepEqual(await readdir(join(path, "documents")), before);
  assert.equal((await store.metadata()).observations.length, 1024);
});

test("metadata-only captures retain saved alternatives and reopen documents without returning the landscape payload", async t => {
  const { path, store } = await setup(t);
  let saved = await store.capture(captureFixture());
  const id = saved.project.screens[0].id;
  const history = [{ type: "duplicateScreen", screenId: id, newId: "design-copy", value: "Design alternative" }, { type: "setText", screenId: "design-copy", layerId: "n3", value: "Saved design" }];
  await store.save({ expectedRevision: saved.project.revision, history, cursor: history.length });
  const next = captureFixture("next-screen"); next.document.root.children[0].children[0].text = "New screen";
  const metadata = await store.capture(next, { metadataOnly: true });
  assert.equal(metadata.documents, undefined, "capture status must not retain every materialized document");
  assert.equal(metadata.assets, undefined, "capture status must not return asset bodies");
  assert.equal(metadata.project.screens.length, 3);
  const reopened = await (await createStore(path)).read();
  assert.deepEqual(metadata.project, reopened.project);
  assert.equal(reopened.documents["design-copy"].root.children[0].children[0].text, "Saved design");
  assert.equal(reopened.documents[id].root.children[0].children[0].text, "Calendar");
  assert.ok(Object.values(reopened.documents).some(doc => doc.root.children[0].children[0].text === "New screen"));
});
