import assert from "node:assert/strict";
import test from "node:test";
import { journeyPlan, locateStep, remainingDuration, stepCount, stepOffset, formatTime } from "../lib/playback.mjs";

const definitions = [
  { id: "cross", entry: "home", steps: [{ screen: "home", actions: [{ type: "fill" }, { type: "expect" }] }, { screen: "detail", actions: [{ type: "click" }] }] },
  { id: "local", entry: "detail", steps: [{ screen: "detail", actions: [{ type: "expect" }] }] },
  { id: "case", kind: "case", entry: "quiet", steps: [{ screen: "quiet", actions: [{ type: "expect" }] }] },
];
const project = { journeys: definitions, catalog: [{ id: "home", pageId: "home" }, { id: "detail", pageId: "settings" }, { id: "quiet", pageId: "reference" }] };

test("demo scope keeps authored order, standalone labels and whole cross-page flows", () => {
  assert.deepEqual(journeyPlan(project, "__all__"), definitions);
  assert.deepEqual(journeyPlan(project, "__flows__"), definitions.slice(0, 2));
  assert.deepEqual(journeyPlan(project, "__cases__"), [definitions[2]]);
  assert.deepEqual(journeyPlan(project, "__page__:settings"), definitions.slice(0, 2));
  assert.equal(journeyPlan(project, "__page__:settings")[0].steps[0].screen, "home");
  assert.deepEqual(journeyPlan(project, "local"), [definitions[1]]);
  assert.deepEqual(journeyPlan(project, ""), []);
  assert.deepEqual(journeyPlan(project, "__page__:missing"), []);
});

test("timeline resolves boundaries to fresh flows and clamps both ends", () => {
  assert.equal(stepCount(definitions), 4);
  assert.equal(stepOffset(definitions, 2), 3);
  assert.deepEqual(locateStep(definitions, -10), { queue: 0, step: 0 });
  assert.deepEqual(locateStep(definitions, 1), { queue: 0, step: 1 });
  assert.deepEqual(locateStep(definitions, 2), { queue: 1, step: 0 });
  assert.deepEqual(locateStep(definitions, 100), { queue: 2, step: 1 });
  assert.equal(locateStep([], 0), null);
});

test("time estimates count remaining pacing, exclude checks and respond to rate", () => {
  const state = { queueIndex: 0, completed: 0, index: 0, actionIndex: 0, status: "loading" };
  // Three entry holds, three step holds and two visible app operations.
  assert.equal(remainingDuration(definitions, state, 900), 7200);
  assert.equal(remainingDuration(definitions, state, 225), 1800);
  assert.equal(remainingDuration(definitions, state, 0), 0);
  assert.equal(remainingDuration(definitions, { ...state, status: "complete" }, 900), 0);
  assert.equal(remainingDuration(definitions, { ...state, completed: 1, status: "paused" }, 900), 4500);
  assert.equal(formatTime(3661000), "61:01");
  assert.equal(formatTime(-10), "00:00");
});
