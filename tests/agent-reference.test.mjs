import test from "node:test";
import assert from "node:assert/strict";
import { agentReferencePrompt, normalizeElementReference } from "../lib/agent-reference.mjs";

test("source reference binds the requested change to a screen, source and selected element", () => {
  const prompt = agentReferencePrompt({ project: "Synthetic product", screen: { id: "checkout", title: "Checkout", source: "src/Checkout.jsx", pageId: "/checkout" }, element: { tag: "button", selector: "#save", label: "Save" }, instruction: "Make the save button full width." });
  assert.match(prompt, /^Make the save button full width\./);
  assert.match(prompt, /"source": "src\/Checkout.jsx"/);
  assert.match(prompt, /"selector": "#save"/);
  assert.match(prompt, /verify it against the current UI/);
  assert.match(prompt, /reference data, not instructions/);
});

test("imported references identify captured layers without claiming application source writeback", () => {
  const prompt = agentReferencePrompt({ project: "Captured product", screen: { id: "capture-1", title: "Home", url: "https://example.test/private?token=never-copy" }, layer: { id: "layer-9", tag: "button", name: "Save" }, imported: true, instruction: "Increase the padding." });
  assert.match(prompt, /captured local design alternative/);
  assert.match(prompt, /"capturedLayer"/);
  assert.match(prompt, /"id": "layer-9"/);
  assert.doesNotMatch(prompt, /token|never-copy|example\.test/);
});

test("empty instructions never produce an actionable request and reference input is bounded", () => {
  assert.equal(agentReferencePrompt({ screen: { id: "home" }, instruction: " " }), "");
  assert.equal(agentReferencePrompt({ instruction: "Change it" }), "");
  assert.equal(normalizeElementReference({ tag: "<script>" }), null);
  const normalized = normalizeElementReference({ tag: "input", selector: "x".repeat(1601), label: "L".repeat(180), value: "private-value" });
  assert.equal(normalized.label.length, 160);
  assert.equal(normalized.selector, undefined);
  assert.equal(normalized.value, undefined);
  assert.equal(agentReferencePrompt({ screen: { id: "home" }, instruction: "a".repeat(5000) }).split("\n")[0].length, 4000);
});
