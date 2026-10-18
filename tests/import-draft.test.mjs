import test from "node:test";
import assert from "node:assert/strict";
import { documentFixture, projectFixture } from "./fixtures/import-model.mjs";
const draft = await import("../ui/import/draft.js");
test("desktop document cache is bounded and preserves unsaved document ownership", () => {
  assert.equal(typeof draft.retainDocument, "function", "bounded import document cache must exist");
  let cache = {}; for (let i = 0; i < 8; i++) cache = draft.retainDocument(cache, `doc-${i}`, { index: i }, false);
  const next = draft.retainDocument(cache, "doc-next", { index: 8 }, false);
  assert.equal(Object.keys(next).length, 8); assert.ok(!next["doc-0"]); assert.ok(next["doc-next"]);
  assert.throws(() => draft.retainDocument(cache, "doc-next", {}, true), /save/i);
  assert.equal(Object.keys(cache).length, 8, "failed admission never evicts unsaved documents");
});
test("selected imported copies materialize global undo history without unrelated document loading", () => {
  const project = projectFixture(), base = documentFixture();
  project.screens.push({ ...project.screens[0], id: "unrelated", documentId: "other-doc" });
  const history = [{ type: "setText", screenId: "unrelated", layerId: "n3", value: "Unrelated" }, { type: "duplicateScreen", screenId: "screen-a", newId: "alternative", value: "Alternative" }, { type: "setText", screenId: "alternative", layerId: "n3", value: "Local variant" }];
  assert.equal(draft.materialize(base, project, history, 3, "alternative").root.children[0].children[0].text, "Local variant");
  assert.equal(draft.materialize(base, project, history, 2, "alternative").root.children[0].children[0].text, "Calendar");
});
test("a copy inherits only ancestor edits before its creation", () => {
  const project = projectFixture(), base = documentFixture();
  const history = [
    { type: "setText", screenId: "screen-a", layerId: "n3", value: "Before copy" },
    { type: "duplicateScreen", screenId: "screen-a", newId: "first-copy", value: "First" },
    { type: "setText", screenId: "screen-a", layerId: "n3", value: "After copy" },
    { type: "duplicateScreen", screenId: "first-copy", newId: "nested-copy", value: "Nested" },
    { type: "setText", screenId: "first-copy", layerId: "n3", value: "After nested copy" },
  ];
  assert.equal(draft.materialize(base, project, history, history.length, "nested-copy").root.children[0].children[0].text, "Before copy");
  assert.equal(draft.materialize(base, project, history, history.length, "first-copy").root.children[0].children[0].text, "After nested copy");
});
