import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProject, publicProject } from "../lib/protocol.mjs";
import { scopedScreens } from "../lib/pages.mjs";
const project = () => ({ title: "Pages", groups: [{ id: "app" }], pages: [{ id: "home", title: "Home", route: "/" }], catalog: [{ id: "a", title: "A", group: "app", pageId: "home", feature: "Capture" }] });
test("page and feature ownership reaches the real public/static entry point", () => {
  const result = publicProject(validateProject(project()));
  assert.equal(result.pages?.[0].route, "/");
  assert.equal(result.catalog[0].pageId, "home");
  assert.equal(result.catalog[0].feature, "Capture");
});
test("declared page ownership fails closed for missing or duplicate pages", () => {
  const missing = project(); missing.catalog[0].pageId = "absent";
  assert.throws(() => validateProject(missing), /page/i);
  const duplicate = project(); duplicate.pages.push({ id: "home", title: "Other" });
  assert.throws(() => validateProject(duplicate), /page/i);
});
test("legacy fixture pagination does not become canvas page ownership", () => {
  const p = project(); delete p.pages; delete p.catalog[0].pageId; p.catalog[0].page = 2;
  const result = validateProject(p);
  assert.equal(result.catalog[0].page, 2, "adapter fixture input remains unchanged");
  assert.equal(result.catalog[0].pageId, "app", "legacy groups remain valid scopes");
});
test("depth collapses variants within a page without losing selected or searched states", () => {
  const catalog = [
    {id:"home",pageId:"home",feature:"Records",title:"Populated"},
    {id:"empty",pageId:"home",feature:"Records",title:"Empty"},
    {id:"import",pageId:"home",feature:"Import",title:"Import"},
    {id:"settings",pageId:"settings",feature:"Profile",title:"Settings"},
  ];
  assert.deepEqual(scopedScreens(catalog,{page:"home",depth:"1"}).map(s=>s.id),["home","import"]);
  assert.deepEqual(scopedScreens(catalog,{page:"home",depth:"1",selected:"empty"}).map(s=>s.id),["home","empty","import"]);
  assert.deepEqual(scopedScreens(catalog,{depth:"0"}).map(s=>s.id),["home","settings"]);
  assert.deepEqual(scopedScreens(catalog,{query:"empty"}).map(s=>s.id),["empty"]);
});
