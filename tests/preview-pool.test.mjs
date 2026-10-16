import { test } from "node:test";
import assert from "node:assert/strict";
import { previewPool } from "../ui/preview-pool.js";
const nodes = Array.from({length:30},(_,i)=>({id:String(i),type:"screen",position:{x:i*10,y:0},data:{visible:true,height:844}}));
const base={nodes,viewport:{x:0,y:0,zoom:1},area:{width:820,height:900},retained:[],limit:4,playing:false};
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
