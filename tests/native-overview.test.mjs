import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNativeOverview } from "../lib/native-overview.mjs";
import { layoutScreens } from "../ui/layout.js";
const ids = [{ id: "native" }, { id: "react" }], origin = "http://127.0.0.1:6106";
const valid = () => ({ url: "/atlas.webp", sha256: "a".repeat(64), width: 64, height: 128,
  cases: [{ id: "native", x: 0, y: 0, width: 32, height: 64, sourceSha256: "b".repeat(64) }] });
test("native overview is explicit, bounded and does not opt web cases in", () => {
  assert.equal(validateNativeOverview(undefined, ids, origin), undefined);
  const atlas = validateNativeOverview(valid(), ids, origin);
  assert.equal(atlas.url, origin + "/atlas.webp");
  assert.deepEqual(atlas.cases.map(c => c.id), ["native"]);
});
test("large native packing improves fit while retaining page groups and legacy DOM layout",()=>{
 const catalog=Array.from({length:1756},(_,i)=>({id:`n-${i}`,group:`page-${i%4}`,viewport:{width:390,height:844}}));
 const groups=Array.from({length:4},(_,i)=>({id:`page-${i}`}));
 const manifest={screens:Object.fromEntries(catalog.map(c=>[c.id,{width:390,height:844}]))};
 const old=layoutScreens(catalog,manifest,groups),dom=layoutScreens(catalog,manifest,groups,{nativeOverview:false,area:{width:1012,height:930}});
 assert.deepEqual(dom,old,"ordinary source DOM geometry stays unchanged");
 const compact=layoutScreens(catalog,manifest,groups,{nativeOverview:true,area:{width:1012,height:930}});
 const height=nodes=>Math.max(...nodes.map(n=>n.position.y+n.style.height));
 assert.ok(height(compact)<height(old)/2,"native pages cannot remain tall narrow strips at whole-app fit");
 assert.deepEqual(compact.filter(n=>n.type==='screen').map(n=>n.id),old.filter(n=>n.type==='screen').map(n=>n.id));
 assert.equal(compact.filter(n=>n.type==='section').length,4);
});
test("reject invalid or unregistered native assets rather than silently replacing a runtime", () => {
  for (const change of [a=>a.url="https://example.com/a.webp",a=>a.url="http://user:pw@127.0.0.1:6106/a",a=>a.sha256="unknown",a=>a.width=8192,a=>{a.width=4096;a.height=4096},a=>a.cases[0].x=-1,a=>a.cases[0].height=129,a=>a.cases[0].id="missing",a=>a.cases.push({...a.cases[0]}),a=>a.cases[0].sourceSha256="",a=>a.height=NaN]) {
    const value=valid();change(value);assert.throws(()=>validateNativeOverview(value,ids,origin));
  }
});
