import test from "node:test";
import assert from "node:assert/strict";
import { layoutScreens } from "../ui/layout.js";

test("machine layout follows branches and recovery cycles without hiding cases or overlapping cards", () => {
  const screens = ["home", "saved", "failed", "pending"].map(id => ({ id, title: id, group: "app" }));
  const flows = [{ from: "home", to: "pending" }, { from: "pending", to: "saved" }, { from: "pending", to: "failed" }, { from: "failed", to: "pending" }];
  const nodes = layoutScreens(screens, {}, [{ id: "app" }], { mode: "machine", flows });
  assert.equal(nodes.length, 4, "machine uses state cards, without overview section boxes");
  assert.equal(new Set(nodes.map(n => n.id)).size, 4);
  assert.ok(nodes.every(n=>n.initialHeight<=160), "full graph uses legible compact state cards");
  assert.ok(nodes.find(n=>n.id==="home").position.x < nodes.find(n=>n.id==="pending").position.x);
  for (const a of nodes) for (const b of nodes) if (a.id !== b.id) {
    assert.ok(a.position.x + a.initialWidth <= b.position.x || b.position.x + b.initialWidth <= a.position.x || a.position.y + a.initialHeight <= b.position.y || b.position.y + b.initialHeight <= a.position.y, `${a.id} overlaps ${b.id}`);
  }
  const expanded = layoutScreens(screens, {}, [{id:"app"}], {mode:"machine",flows,focusedId:"failed"});
  assert.equal(expanded.find(n=>n.id==="failed").data.compact,false);
  assert.ok(expanded.find(n=>n.id==="failed").initialHeight>=844,"selected state expands its real viewport");
});
