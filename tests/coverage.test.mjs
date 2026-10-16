import test from "node:test";
import assert from "node:assert/strict";
import { validateProject, publicProject } from "../lib/protocol.mjs";
import { graphFlows } from "../lib/coverage.mjs";

const example = () => ({
  title: "Cases", groups: [{ id: "app" }],
  catalog: [
    { id: "home", title: "Home", group: "app", outcome: "neutral" },
    { id: "failed", title: "Failed", group: "app", outcome: "failure" },
  ],
  flows: [{ from: "home", to: "failed", label: "Offline", kind: "condition" }],
  journeys: [{ id: "home-case", title: "Home case", kind: "case", entry: "home", steps: [{ title: "Visible", screen: "home", actions: [{ type: "expect", selector: "h1", text: "Home" }] }] }],
  coverage: { requireAllCases: true, requireConnected: true },
});

test("complete coverage rejects a newly registered state without a checked playable case", () => {
  assert.throws(() => validateProject(example()), /failed.*case|case.*failed/i);
  const p = example();
  p.journeys.push({ id: "failed-case", title: "Failed case", kind: "case", entry: "failed", steps: [{ title: "Error visible", screen: "failed", actions: [{ type: "expect", selector: "output", text: "Offline" }] }] });
  assert.doesNotThrow(() => validateProject(p));
  p.journeys[1].steps[0].actions = [{ type: "click", selector: "button" }];
  assert.throws(() => validateProject(p), /assert|expect|case/i);
});

test("complete graph rejects disconnected cases and preserves public state semantics", () => {
  const p = example(); p.coverage.requireAllCases = false;
  assert.equal(publicProject(validateProject(p)).catalog[1].outcome, "failure");
  p.flows = [];
  assert.throws(() => validateProject(p), /disconnect|isolated/i);
});

test("invalid outcome and transition semantics fail rather than silently coloring the graph", () => {
  const p = example(); p.coverage = {};
  p.catalog[1].outcome = "diagnosed";
  assert.throws(() => validateProject(p), /outcome/i);
  p.catalog[1].outcome = "failure"; p.flows[0].kind = "invented";
  assert.throws(() => validateProject(p), /kind|transition/i);
});

test("checked operations take precedence over a condition reference and failed-to-saved edges name recovery", () => {
  const p = { catalog: [{id:"home"},{id:"failed",outcome:"failure"},{id:"saved",outcome:"success"}], flows:[{from:"home",to:"failed",label:"Offline fixture",kind:"condition"}], journeys:[{entry:"home",steps:[{screen:"failed",title:"Fail save",actions:[{type:"click",selector:"button"},{type:"expect",selector:"output"}]},{screen:"saved",title:"Retry",actions:[{type:"click",selector:"button"},{type:"expect",selector:"output"}]}]}] };
  assert.deepEqual(graphFlows(p).map(f=>[f.from,f.to,f.kind]),[["home","failed","action"],["failed","saved","recovery"]]);
});
