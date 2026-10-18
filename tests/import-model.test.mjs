import test from "node:test";
import assert from "node:assert/strict";
import { documentFixture, projectFixture } from "./fixtures/import-model.mjs";
const schema = await import("../lib/import/schema.mjs").catch(() => ({}));
const patches = await import("../lib/import/patches.mjs").catch(() => ({}));
const render = await import("../lib/import/render.mjs").catch(() => ({}));

test("import documents reject executable tags, CSS resources, handlers and duplicate identities", () => {
  assert.equal(typeof schema.validateDocument, "function", "validated import documents must exist");
  assert.equal(schema.validateDocument(documentFixture()).id, "doc-a");
  for (const mutate of [d => d.root.tag = "script", d => d.root.attrs.onclick = "alert(1)", d => d.root.style.color = "red; background:url(https://example.test/leak)", d => d.root.style["background-image"] = 'u\\72l(https://example.test/leak)', d => d.root.children[1].id = "n2", d => d.root.attrs.src = "javascript:alert(1)", d => d.root.children[0].tag = "foreignObject"]) {
    const doc = documentFixture(); mutate(doc); assert.throws(() => schema.validateDocument(doc));
  }
});

test("all desktop edits are reversible without changing immutable captures or neighboring screens", () => {
  assert.equal(typeof patches.applyEdits, "function", "reversible imported edits must exist");
  const project = projectFixture(), base = documentFixture(), documents = { "doc-a": base };
  const history = [
    { type: "setText", screenId: "screen-a", layerId: "n3", value: "Our calendar" },
    { type: "setStyle", screenId: "screen-a", layerId: "n2", property: "color", value: "rgb(0, 100, 80)" },
    { type: "move", screenId: "screen-a", layerId: "n4", x: 30, y: 40 },
    { type: "resize", screenId: "screen-a", layerId: "n4", width: 300, height: 160 },
    { type: "rename", screenId: "screen-a", layerId: "n4", value: "Reference card" },
    { type: "duplicate", screenId: "screen-a", layerId: "n4", newId: "copy-card" },
    { type: "setHidden", screenId: "screen-a", layerId: "copy-card", value: true },
    { type: "reorder", screenId: "screen-a", layerId: "copy-card", direction: "backward" },
    { type: "duplicateScreen", screenId: "screen-a", newId: "screen-copy", value: "Alternative" },
    { type: "setText", screenId: "screen-copy", layerId: "n3", value: "Alternative copy" },
  ];
  const result = patches.applyEdits(project, documents, history, history.length);
  assert.equal(result.documents["screen-a"].root.children[0].children[0].text, "Our calendar");
  assert.equal(result.documents["screen-copy"].root.children[0].children[0].text, "Alternative copy");
  const card = result.documents["screen-a"].root.children.find(n => n.id === "n4");
  assert.deepEqual(card.offset, { x: 30, y: 40 }); assert.equal(card.style.width, "300px"); assert.equal(card.name, "Reference card");
  assert.equal(result.documents["screen-a"].root.children.find(n => n.id === "copy-card").hidden, true);
  assert.deepEqual(base, documentFixture(), "base capture stays immutable");
  assert.deepEqual(patches.applyEdits(project, documents, history, 0).documents["screen-a"], base);
  const reset = patches.applyEdits(project, documents, [...history, { type: "resetLayer", screenId: "screen-a", layerId: "n4" }], history.length + 1);
  assert.equal(reset.documents["screen-a"].root.children.find(n => n.id === "n4").style.width, "200px");
  const cleared = patches.applyEdits(project, documents, [...history, { type: "resetScreen", screenId: "screen-a" }], history.length + 1);
  assert.deepEqual(cleared.documents["screen-a"], base);
  assert.throws(() => patches.applyEdits(project, documents, [{ type: "setStyle", screenId: "screen-a", layerId: "n4", property: "background-image", value: "url(https://example.test)" }], 1));
});

test("import renderer escapes text and uses only normalized local document content", () => {
  assert.equal(typeof render.renderDocument, "function", "safe import renderer must exist");
  const doc = documentFixture(); doc.root.children[0].children[0].text = '<img src=x onerror="alert(1)">';
  const html = render.renderDocument(doc);
  assert.ok(html.includes("&lt;img")); assert.ok(!html.includes('<img src="x"'));
  assert.ok(html.includes("default-src 'none'")); assert.ok(!html.includes("https://"));
});
