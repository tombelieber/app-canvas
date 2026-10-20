import "./fixtures/import-storage.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentProject, decodeSnapshot, ingestSnapshot, importStatus, linkStates, captureScript } from "../lib/import/agent.mjs";
import { validateImportOptions } from "../lib/import/options.mjs";
import { createStore } from "../lib/import/store.mjs";
import { documentFixture } from "./fixtures/import-model.mjs";
const snapshot = (path = "/calendar") => {
  const doc = documentFixture();
  return { version: 1, url: `https://example.test${path}`, redacted: false, rendered: { ...doc, baseUrl: "https://example.test/", families: [], embeddedStyles: [], title: "Calendar" }, resources: [] };
};
const project = async fn => { const root = await mkdtemp(join(tmpdir(), "canvas-agent-")); try { const directory = join(root, "project"); await createAgentProject({ directory, allowEphemeral: true, url: "https://example.test/calendar?private=removed" }); await fn(directory); } finally { await rm(root, { recursive: true, force: true }); } };

test("agent ingest retains saved edits, separates observations and reference edges", () => project(async directory => {
  const first = await ingestSnapshot({ directory, snapshot: snapshot(), label: "Calendar" });
  const store = await createStore(directory), base = await store.read();
  await store.save({ expectedRevision: base.project.revision, history: [{ type: "setText", screenId: first.screenId, layerId: "n3", value: "Saved alternative" }], cursor: 1 });
  const next = snapshot("/settings"); next.rendered.root.children[0].children[0].text = "Settings";
  const second = await ingestSnapshot({ directory, snapshot: next, label: "Settings", action: "Open Settings" });
  await linkStates({ directory, from: second.screenId, to: first.screenId, label: "Related reference" });
  const status = await importStatus(directory);
  assert.deepEqual(status.flows, { observed: 1, reference: 1 }); assert.equal(status.savedEdits, 1); assert.equal(status.coverage, "observed"); assert.equal(status.source, "https://example.test/calendar");
  assert.equal((await store.read()).documents[first.screenId].root.children[0].children[0].text, "Saved alternative");
  const before = status.revision;
  await assert.rejects(linkStates({ directory, from: second.screenId, to: "missing", label: "Invalid" }), /Invalid imported flow/);
  assert.equal((await importStatus(directory)).revision, before, "invalid link leaves accepted project intact");
}));

test("agent import rejects source drift, private surfaces, active markup and bad transport", () => project(async directory => {
  const foreign = snapshot(); foreign.url = "https://foreign.test/calendar";
  await assert.rejects(ingestSnapshot({ directory, snapshot: foreign }), /origin/);
  await assert.rejects(ingestSnapshot({ directory, snapshot: snapshot("/api-keys") }), /allowlisted/);
  const active = snapshot(); active.rendered.root.children.push({ id: "evil", tag: "script", attrs: {}, children: [] });
  await assert.rejects(ingestSnapshot({ directory, snapshot: active }), /Unsupported document tag/);
  const tiny = snapshot(); tiny.rendered.viewport.width = 390;
  await assert.rejects(ingestSnapshot({ directory, snapshot: tiny }), /geometry/);
  const redacted = snapshot(); redacted.redacted = true; redacted.resources = [{ data: "private" }];
  await assert.rejects(ingestSnapshot({ directory, snapshot: redacted }), /Redacted snapshots/);
  assert.throws(() => decodeSnapshot(["1000", "{}"]), /Truncated/);
  assert.throws(() => decodeSnapshot({ paused: true }), /paused/);
  assert.throws(() => captureScript({ allowText: ["Public"] }), /redacted mode/);
  const leaked = snapshot(); leaked.redacted = true; leaked.rendered.root.resource = "data:image/png;base64,aGVsbG8=";
  await assert.rejects(ingestSnapshot({ directory, snapshot: leaked }), /cannot include resource references/);
  const hiddenState = snapshot(); hiddenState.rendered.root.session = "unobserved data";
  await assert.rejects(ingestSnapshot({ directory, snapshot: hiddenState }), /Unsupported rendered layer/);
  assert.equal((await importStatus(directory)).states, 0);
}));

test("agent resources are byte checked, never read arbitrary files or fetch missing URLs", () => project(async directory => {
  const withImage = snapshot(); withImage.rendered.root.children.push({ id: "photo", tag: "img", attrs: {}, style: {}, children: [], resource: "https://example.test/image.png" });
  withImage.resources = [{ url: "https://example.test/image.png", kind: "image", data: Buffer.from("arbitrary script").toString("base64") }];
  const missing = await ingestSnapshot({ directory, snapshot: withImage });
  assert.equal(missing.quality, "partial"); assert.ok(missing.issues.includes("Resource unavailable locally"));
  const bad = snapshot(); bad.resources = [{ url: "file:///etc/passwd", kind: "image", data: "aGVsbG8=" }];
  await assert.rejects(ingestSnapshot({ directory, snapshot: bad }), /resource URL/);
  bad.resources = [{ url: "https://example.test/photo", kind: "font", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" }];
  await assert.rejects(ingestSnapshot({ directory, snapshot: bad }), /kind does not match/);
}));

test("redaction flags cannot be silently ignored after transport", () => {
  assert.throws(() => validateImportOptions("capture", { input: "snapshot.json", redacted: true }), /Unsupported --redacted/);
  assert.throws(() => validateImportOptions("import", { out: "project", redacted: true }), /Unsupported --redacted/);
  assert.doesNotThrow(() => validateImportOptions("capture-script", { out: "reader.js", redacted: true }));
});
