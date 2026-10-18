import { test } from "node:test";
import assert from "node:assert/strict";
import { previewPool, visiblePreviews, renderedNodes } from "../ui/preview-pool.js";
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
test("GPU-native passive images do not boot app frames, while selected and retained originals survive",()=>{
 const native=nodes.map(n=>({...n,data:{...n.data,nativePreview:true}}));
 assert.equal(previewPool({...base,nodes:native}).size,0);
 assert.deepEqual([...previewPool({...base,nodes:native,selected:"10",retained:["old"]})],["old","10"]);
 assert.equal(previewPool({...base,nodes:native.map(n=>({...n,data:{...n.data,nativeDetail:true}}))}).size,4,"nearby originals still render at full resolution within the existing budget");
 const pending=nodes.map(n=>({...n,data:{...n.data,nativePending:true}}));
 assert.equal(previewPool({...base,nodes:pending}).size,0,"loading an atlas cannot briefly boot every passive native fixture");
 assert.deepEqual([...previewPool({...base,nodes:pending,selected:"10",retained:["old"]})],["old","10"],"original interaction remains available while the optional atlas loads");
});
test("a fifteen-thousand-state overview bounds passive work without removing catalog nodes",()=>{
  const landscape=Array.from({length:15000},(_,i)=>({id:`case-${i}`,type:"screen",position:{x:(i%20)*490,y:Math.floor(i/20)*900},data:{visible:true,height:844}}));
  const visible=visiblePreviews(landscape,{x:0,y:0,zoom:.001},base.area);
  assert.ok(visible.size<=128,`${visible.size} simultaneous passive previews exceed the document budget`);
  assert.equal(landscape.length,15000);
  const target=landscape.at(-1);
  assert.ok(visiblePreviews(landscape,{x:-target.position.x,y:-target.position.y,zoom:1},base.area).has(target.id),"the final case stays addressable by camera navigation");
});
test("a complete native catalog bounds card DOM and preserves offscreen running drafts",()=>{
  const catalog=Array.from({length:20637},(_,i)=>({id:`native-${i}`,type:"screen",data:{visible:true}}));
  const previews=new Set(catalog.slice(0,128).map(n=>n.id));
  const retained=new Set([catalog.at(-1).id]);
  const result=renderedNodes(catalog,previews,retained);
  assert.equal(result.length,catalog.length,"source IDs remain in the graph model");
  assert.equal(result.filter(n=>!n.data.shellOnly).length,129,"offscreen card DOM is bounded separately from preview documents");
  assert.equal(result.at(-1).data.shellOnly,false,"retained native app ancestors must never unmount");
  const moved=renderedNodes(catalog,new Set([catalog[19000].id]),retained);
  assert.equal(moved.find(n=>n.id==='native-19000').data.shellOnly,false,"camera navigation can address a case outside the original viewport");
  assert.equal(moved.at(-1).data.shellOnly,false);
  assert.deepEqual(result.map(n=>n.id),catalog.map(n=>n.id),"camera/filter changes preserve sibling order for running frames");
});
test("camera-only updates reuse unchanged graph nodes and tiny GPU captures need no card DOM",()=>{
 const source=Array.from({length:260},(_,i)=>({id:`gpu-${i}`,type:"screen",position:{x:i*10,y:0},data:{nativePreview:true,nativeDetail:false}}));
 const visible=new Set(source.map(n=>n.id)),mounted=new Set([source[0].id]);
 const first=renderedNodes(source,visible,mounted),next=renderedNodes(source,new Set([source[1].id]),mounted);
 assert.equal(first[1].data.shellOnly,true,"the GPU already paints the complete capture at tiny scale");
 assert.strictEqual(first[1],next[1],"a camera update cannot invalidate every graph node");
 assert.strictEqual(first,next,"unchanged shell coverage cannot rebuild the entire graph store");
 assert.strictEqual(first[0],next[0],"retained original runtime ancestors stay stable");
 const changed=[{...source[0],position:{x:100,y:0}},...source.slice(1)];
 assert.notStrictEqual(renderedNodes(changed,visible,mounted)[0],first[0],"real layout changes must still propagate");
});
