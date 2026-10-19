import test from "node:test";
import assert from "node:assert/strict";
import { documentFixture, projectFixture } from "./fixtures/import-model.mjs";
const schema = await import("../lib/import/schema.mjs").catch(() => ({}));
const patches = await import("../lib/import/patches.mjs").catch(() => ({}));
const render = await import("../lib/import/render.mjs").catch(() => ({}));
const styles = await import("../lib/import/styles.mjs");

test("named grid placement retains its defining template through capture and rendering", () => {
  const doc = documentFixture();
  const resolved = { display: "grid", "grid-template-columns": "240px 1200px", "grid-template-rows": "0px 1000px", "grid-template-areas": '"navbar navbar" "sidebar main"' };
  // The capture reader copies only these computed properties; omitting areas sends
  // named children to implicit tracks outside the captured viewport.
  doc.root.style = Object.fromEntries(styles.styleProperties.filter(key => key in resolved).map(key => [key, resolved[key]]));
  doc.root.children[0].style = { "grid-column-start": "main", "grid-column-end": "main", "grid-row-start": "main", "grid-row-end": "main" };
  schema.validateDocument(doc);
  const html = render.renderDocument(doc);
  assert.equal(doc.root.style["grid-template-areas"], resolved["grid-template-areas"]);
  assert.match(html, /grid-template-areas:&quot;navbar navbar&quot;\s*&quot;sidebar main&quot;/);
  assert.ok(html.includes("grid-column-start:main"));
});

test("import documents reject executable tags, CSS resources, handlers and duplicate identities", () => {
  assert.equal(typeof schema.validateDocument, "function", "validated import documents must exist");
  assert.equal(schema.validateDocument(documentFixture()).id, "doc-a");
  for (const mutate of [d => d.root.tag = "script", d => d.root.attrs.onclick = "alert(1)", d => d.root.style.color = "red; background:url(https://example.test/leak)", d => d.root.style["background-image"] = 'u\\72l(https://example.test/leak)', d => d.root.children[1].id = "n2", d => d.root.attrs.src = "javascript:alert(1)", d => d.root.children[0].tag = "foreignObject"]) {
    const doc = documentFixture(); mutate(doc); assert.throws(() => schema.validateDocument(doc));
  }
});

test("SVG masks accept local fragments while rejecting remote resources", () => {
  const doc = documentFixture();
  doc.root.children.push({ id: "masked-svg", tag: "svg", attrs: {}, style: {}, children: [
    { id: "masked-group", tag: "g", attrs: { mask: "url(#shape-mask)" }, style: {}, children: [] },
  ] });
  assert.equal(schema.validateDocument(doc), doc);
  assert.match(render.renderDocument(doc), /mask="url\(#shape-mask\)"/);
  doc.root.children.at(-1).children[0].attrs.mask = "url(https://example.test/private)";
  assert.throws(() => schema.validateDocument(doc), /local asset/);
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

test("import identities cannot collide with object prototypes", () => {
  for (const id of ["__proto__", "constructor", "prototype", "toString", "hasOwnProperty"]) {
    const doc = documentFixture(); doc.root.id = id; assert.throws(() => schema.validateDocument(doc), /identity/i);
    const project = projectFixture(); project.screens[0].id = id; assert.throws(() => schema.validateProject(project), /identity/i);
  }
});

test("duplicated SVG definitions and local paint references remain independent", () => {
  const doc = documentFixture();
  doc.root.children.push({ id: "svg-root", tag: "svg", attrs: { viewBox: "0 0 24 24" }, style: { width: "24px", height: "24px" }, children: [
    { id: "defs", tag: "defs", attrs: {}, style: {}, children: [{ id: "gradient", tag: "linearGradient", attrs: { id: "paint" }, style: {}, children: [{ id: "stop", tag: "stop", attrs: { offset: "0" }, style: { "stop-color": "red" }, children: [] }] }] },
    { id: "shape", tag: "path", attrs: { d: "M0 0h24v24H0z" }, style: { fill: "url(#paint)" }, children: [] },
  ] });
  const history = [{ type: "duplicate", screenId: "screen-a", layerId: "svg-root", newId: "svg-copy" }];
  const result = patches.applyEdits(projectFixture(), { "doc-a": doc }, history, 1).documents["screen-a"];
  const first = result.root.children.find(n => n.id === "svg-root"), copy = result.root.children.find(n => n.id === "svg-copy");
  const originalId = first.children[0].children[0].attrs.id, copiedId = copy.children[0].children[0].attrs.id;
  assert.notEqual(copiedId, originalId, "copied gradients need their own DOM identity");
  assert.ok(copy.children[1].style.fill.includes(`#${copiedId}`)); assert.ok(first.children[1].style.fill.includes(`#${originalId}`));
});

test("resizing one axis preserves inherited text geometry on the other axis", () => {
  const doc = documentFixture(), history = [{ type: "resize", screenId: "screen-a", layerId: "n3", width: 240 }];
  const node = patches.applyEdits(projectFixture(), { "doc-a": doc }, history, 1).documents["screen-a"].root.children[0].children[0];
  assert.equal(node.style.width, "240px"); assert.equal(node.style.height, undefined);
});

test("undo snapshots stay isolated while redo tails and reserved capture bytes are validated", () => {
  const project = projectFixture(), base = documentFixture(), bases = { "doc-a": base };
  const history = [
    { type: "setText", screenId: "screen-a", layerId: "n3", value: "First edit" },
    { type: "duplicateScreen", screenId: "screen-a", newId: "copy", value: "Copy" },
    { type: "setText", screenId: "screen-a", layerId: "n3", value: "Later edit" },
  ];
  const undone = patches.applyEdits(project, bases, history, 1);
  assert.equal(undone.screens.length, 1);
  assert.equal(undone.documents["screen-a"].root.children[0].children[0].text, "First edit");
  const complete = patches.applyEdits(project, bases, history, history.length);
  assert.equal(complete.documents.copy.root.children[0].children[0].text, "First edit");
  assert.equal(complete.documents["screen-a"].root.children[0].children[0].text, "Later edit");
  complete.documents["screen-a"].root.children[0].children[0].text = "Caller mutation";
  assert.equal(base.root.children[0].children[0].text, "Calendar");
  assert.throws(() => patches.applyEdits(project, bases, [...history, { type: "setText", screenId: "missing", layerId: "n3", value: "Invalid redo" }], 1), /missing screen/i);
  assert.throws(() => patches.applyEdits(project, bases, [], 0, 512 * 1024 ** 2), /size limit/i);
});

test("metadata replay validates every redo edit without retaining document copies", () => {
  const project = projectFixture(), base = documentFixture(), bases = { "doc-a": base };
  const history = [{ type: "duplicateScreen", screenId: "screen-a", newId: "copy", value: "Copy" }, { type: "setText", screenId: "copy", layerId: "n3", value: "Changed copy" }];
  const metadata = patches.applyEdits(project, bases, history, 1, 0, { metadataOnly: true });
  assert.equal(metadata.documents, undefined);
  assert.deepEqual(metadata.screens, patches.applyEdits(project, bases, history, 1).screens);
  assert.equal(base.root.children[0].children[0].text, "Calendar");
  assert.throws(() => patches.applyEdits(project, bases, [...history, { type: "delete", screenId: "copy", layerId: "missing" }], 0, 0, { metadataOnly: true }), /missing layer/i);
});
