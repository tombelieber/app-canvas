import test from "node:test";
import assert from "node:assert/strict";
import { validateProject, localOrigin } from "../lib/protocol.mjs";
const project = () => ({
  title: "Example",
  groups: [{ id: "app", title: "Pages" }],
  catalog: [{ id: "home", title: "Home", group: "app" }],
  flows: [],
});
test("catalog is explicit and has no duplicate or dangling nodes", () => {
  assert.equal(validateProject(project()).title, "Example");
  const p = project();
  p.flows = [{ from: "home", to: "missing" }];
  assert.throws(() => validateProject(p), /missing/);
  p.flows = [];
  p.catalog.push(p.catalog[0]);
  assert.throws(() => validateProject(p), /Duplicate/);
});
test("preview origins are loopback URLs, never production services", () => {
  assert.equal(
    localOrigin("http://127.0.0.1:6199/frame"),
    "http://127.0.0.1:6199",
  );
  for (const url of [
    "https://production.example",
    "file:///etc/passwd",
    "http://127.0.0.1.evil.test",
    "http://user:password@localhost:5000",
  ])
    assert.throws(() => localOrigin(url), /loopback/);
});
