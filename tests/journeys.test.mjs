import test from "node:test";
import assert from "node:assert/strict";
import { validateProject } from "../lib/protocol.mjs";
test("journeys reject missing screens and unsupported actions rather than silently skipping them", () => {
  const p = { title: "Example", groups: [{ id: "app" }], catalog: [{ id: "home", group: "app", title: "Home" }], journeys: [{ id: "happy", title: "Happy", entry: "home", steps: [{ title: "Click", screen: "missing", actions: [{ type: "click", selector: "button" }] }] }] };
  assert.throws(() => validateProject(p), /missing/);
  p.journeys[0].steps[0].screen = "home";
  p.journeys[0].steps[0].actions[0].type = "evaluate-arbitrary-code";
  assert.throws(() => validateProject(p), /action/);
  p.journeys[0].steps[0].actions[0] = { type: "expect", selector: "h1", text: "Home" };
  assert.equal(validateProject(p).journeys.length, 1);
});
