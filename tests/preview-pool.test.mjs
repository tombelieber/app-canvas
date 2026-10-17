import { test } from "node:test";
import assert from "node:assert/strict";
import { previewPool, visiblePreviews } from "../ui/preview-pool.js";
const nodes = Array.from({length:30},(_,i)=>({id:String(i),type:"screen",position:{x:i*10,y:0},data:{visible:true,height:844}}));
const base={nodes,viewport:{x:0,y:0,zoom:1},area:{width:820,height:900},retained:[],limit:4,playing:false};
test("full DOM previews stay visible even at overview zoom, and offscreen documents are released",()=>{
  assert.equal(visiblePreviews(nodes,{x:0,y:0,zoom:.02},base.area).size,30,"overview never substitutes labels for small full screens");
  assert.equal(visiblePreviews(nodes,{x:900,y:0,zoom:1},base.area).size,0,"offscreen source DOM does not stay rendered");
});
test("a full DOM overview does not boot background apps when zoomed in",()=>{
  const sourceNodes=nodes.map(n=>({...n,data:{...n.data,domUrl:`/previews/${n.id}.html`}}));
  assert.equal(previewPool({...base,nodes:sourceNodes}).size,0);
  assert.deepEqual([...previewPool({...base,nodes:sourceNodes,selected:"10"})],["10"]);
});
test("offscreen retained drafts outrank visible previews and selection fits the touch budget",()=>{
  const result=previewPool({...base,retained:["old-a","old-b","old-c"],selected:"10"});
  assert.deepEqual([...result],["old-a","old-b","old-c","10"]);
});
test("playback reserves a live slot without evicting retained drafts",()=>{
  const result=previewPool({...base,retained:["old-a","old-b","old-c"],selected:"10",playing:true});
  assert.deepEqual([...result],["old-a","old-b","old-c"]);
});
test("playback does not start duplicate background app fixtures",()=>{
  assert.equal(previewPool({...base,playing:true,selected:"10"}).size,0,"the continuing player is the only new app instance during playback");
});
test("zoomed-out and collapsed previews do not start background apps",()=>{
  assert.equal(previewPool({...base,viewport:{x:0,y:0,zoom:.02}}).size,0);
  assert.equal(previewPool({...base,nodes:nodes.map(n=>({...n,data:{...n.data,compact:true}}))}).size,0);
  assert.equal(previewPool(base).size,4);
});
test("a fifteen-thousand-state overview bounds passive work without removing catalog nodes",()=>{
  const landscape=Array.from({length:15000},(_,i)=>({id:`case-${i}`,type:"screen",position:{x:(i%20)*490,y:Math.floor(i/20)*900},data:{visible:true,height:844}}));
  const visible=visiblePreviews(landscape,{x:0,y:0,zoom:.001},base.area);
  assert.ok(visible.size<=128,`${visible.size} simultaneous passive previews exceed the document budget`);
  assert.equal(landscape.length,15000);
  const target=landscape.at(-1);
  assert.ok(visiblePreviews(landscape,{x:-target.position.x,y:-target.position.y,zoom:1},base.area).has(target.id),"the final case stays addressable by camera navigation");
});
