import test from "node:test";
import assert from "node:assert/strict";
import { createOverviewLoader, OVERVIEW_LIMIT } from "../ui/overview-loader.js";
const sources = Array.from({ length: 15000 }, (_, index) => ({ id: `case-${index}`, url: `/case-${index}.json` }));
const tick = () => new Promise(resolve => setImmediate(resolve));

test("a large landscape keeps passive documents and requests bounded while every ID remains usable", async () => {
  let active = 0, peak = 0;
  const shown = new Set(), removed = [];
  const loader = createOverviewLoader({
    load: async (source, signal) => { active++; peak = Math.max(peak, active); await tick(); active--; if (signal.aborted) throw Error("aborted"); return { html: source.id }; },
    show: source => shown.add(source.id), evict: id => { shown.delete(id); removed.push(id); }, error: () => assert.fail("valid preview failed"),
  });
  loader.sync(sources.slice(0, OVERVIEW_LIMIT));
  await loader.idle();
  assert.equal(shown.size, OVERVIEW_LIMIT);
  assert.ok(peak <= 4);
  loader.sync(sources.slice(-OVERVIEW_LIMIT));
  await loader.idle();
  assert.equal(shown.size, OVERVIEW_LIMIT);
  assert.ok(shown.has("case-14999"));
  assert.ok(!shown.has("case-0"));
  assert.equal(removed.length, OVERVIEW_LIMIT);
  loader.sync([sources[0]]); await loader.idle();
  assert.ok(shown.has("case-0"), "evicted source UI loads again on return");
  assert.ok(shown.size <= OVERVIEW_LIMIT);
  loader.close();
});

test("an obsolete in-flight preview cannot enter the current document cache", async () => {
  const completions = new Map(), shown = [], errors = [];
  const loader = createOverviewLoader({ load: source => new Promise(resolve => completions.set(source.id, resolve)), show: source => shown.push(source.id), evict: () => {}, error: error => errors.push(error) });
  loader.sync([sources[0]]); await tick();
  loader.sync([sources[1]]); await tick();
  completions.get("case-0")({ html: "old" });
  completions.get("case-1")({ html: "current" });
  await loader.idle();
  assert.deepEqual(shown, ["case-1"]);
  assert.deepEqual(errors, []);
  loader.close();
});

test("a changed URL reloads its source while unchanged previews stay cached", async () => {
  let calls = 0;
  const shown = [];
  const loader = createOverviewLoader({ load: async () => { calls++; return {}; }, show: source => shown.push(source.url), evict: () => {}, error: () => assert.fail() });
  loader.sync([sources[0]]); await loader.idle();
  loader.sync([sources[0]]); await loader.idle();
  assert.equal(calls, 1);
  loader.sync([{ ...sources[0], url: "/updated.json" }]); await loader.idle();
  assert.equal(calls, 2); assert.deepEqual(shown, [sources[0].url, "/updated.json"]);
  loader.close();
});

test("returning to a cancelled source reloads it even before the old request settles", async () => {
  const pending = [], shown = [];
  const loader = createOverviewLoader({ load: source => new Promise(resolve => pending.push({ id: source.id, resolve })), show: source => shown.push(source.id), evict: () => {}, error: () => assert.fail() });
  loader.sync([sources[0]]); await tick();
  loader.sync([sources[1]]); await tick();
  loader.sync([sources[0]]); await tick();
  pending[0].resolve({}); pending[1].resolve({}); await tick();
  assert.equal(pending.length, 3, "the cancelled original request cannot consume the replacement load");
  pending[2].resolve({}); await loader.idle();
  assert.deepEqual(shown, ["case-0"]);
  loader.close();
});
