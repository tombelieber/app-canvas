import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { chromium, webkit } from "./locale-browser.mjs";
import { startCanvas } from "../lib/server.mjs";
const image=await readFile(new URL("./fixtures/native-atlas.png",import.meta.url)),sha=createHash("sha256").update(image).digest("hex");
const js=(await build({entryPoints:[new URL("./fixtures/native-overview-react.jsx",import.meta.url).pathname],bundle:true,write:false,format:"esm",define:{"process.env.NODE_ENV":'"production"'}})).outputFiles[0].text;
const native=Array.from({length:260},(_,i)=>({id:`native-${i}`,title:`native-${i}`,group:"app",pageId:i<130?"a":"b",viewport:{width:390,height:844}}));
const config={title:"Native GPU with original runtime",groups:[{id:"app"}],pages:["a","b","web"].map(id=>({id,title:id})),
 catalog:[...native,...["react","saved"].map(id=>({id,title:id,group:"app",pageId:"web"}))],
 flows:[{from:"native-0",to:"native-259",label:"Across native pages"},{from:"native-259",to:"react",label:"Open React"},{from:"react",to:"saved",label:"Save draft"}],
 journeys:[{id:"react-save",title:"React save",entry:"react",steps:[{title:"Fill",screen:"react",actions:[{type:"fill",selector:"input",value:"player state"},{type:"expect",selector:"input",value:"player state"}]},{title:"Save",screen:"saved",actions:[{type:"click",selector:"button",text:"Save"},{type:"expect",selector:"output",text:"player state"}]}]}],
 preview:ctx=>({url:s=>`${ctx.canvasOrigin}/frame?id=${s.id}`,
  nativeOverview:{url:"/atlas.png",sha256:sha,width:1,height:1,cases:native.map(c=>({id:c.id,x:0,y:0,width:1,height:1,sourceSha256:sha}))},
  handle(req,res,url){if(url.pathname==="/atlas.png"){res.setHeader("Content-Type","image/png");res.end(image);return true;}if(url.pathname==="/react.js"){res.setHeader("Content-Type","text/javascript");res.end(js);return true;}if(url.pathname!=="/frame")return false;
   const isNative=url.searchParams.get("id").startsWith("native-");res.setHeader("Content-Type","text/html");res.end(isNative?'<html data-review-ready="true"><body><img alt="Synthetic native capture" src="/atlas.png" style="width:100%;height:100vh"></body></html>':'<html data-review-ready="false"><body><div id="root"></div><script type="module" src="/react.js"></script></body></html>');return true;}})};
const app=await startCanvas({config,port:0,watchFiles:false,snapshots:false});
try{
 await app.firstBuild;
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1512,height:982},reducedMotion:"reduce"}),errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto(app.address);await page.locator('.native-overview').waitFor();
   const supported=await page.locator('.native-overview canvas').evaluate(c=>!!c.getContext('webgl2',{alpha:true,antialias:false}));
   await page.locator(`.native-overview[data-status="${supported?'ready':'fallback'}"]`).waitFor({timeout:10000});
   if(supported)await page.locator('.native-overview[data-drawn="260"]').waitFor();
   await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
   await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)});
   if(supported){
   assert.equal(await page.locator('.native-overview').getAttribute('data-drawn'),'260',"all native images, not 128 shells, appear in the overview");
   assert.equal(await page.locator('iframe[data-screen]').count(),0,"passive native overview boots no background runtimes");
   // Inspect capture pixels below the existing minimap overlay, then restore
   // ordinary chrome for all actual navigation/player/interaction assertions.
   await page.locator('.react-flow__minimap').evaluate(e=>e.style.visibility='hidden');
   for (const id of ["native-0","native-130","native-259"]) {
    const box=await page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox();
    const pixel=await page.screenshot({clip:{x:Math.floor(box.x+box.width/2),y:Math.floor(box.y+box.height/2),width:1,height:1}});
    const rgb=await page.evaluate(async bytes=>{const im=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:"image/png"})),c=document.createElement("canvas");c.width=c.height=1;const ctx=c.getContext("2d");ctx.drawImage(im,0,0);im.close();return [...ctx.getImageData(0,0,1,1).data].slice(0,3)},[...pixel]);
    if(!rgb.every((v,i)=>Math.abs(v-[208,65,43][i])<4))console.log(JSON.stringify({id,box,canvas:await page.locator('.native-overview canvas').boundingBox(),transform:await page.locator('.react-flow__viewport').evaluate(e=>e.style.transform)}));
    assert.ok(rgb.every((v,i)=>Math.abs(v-[208,65,43][i])<4),`${id} must contain actual capture pixels, not an empty GPU shell: ${rgb}`);
   }
   await page.locator('.react-flow__minimap').evaluate(e=>e.style.visibility='');
   await page.locator('.react-flow__node-screen[data-id="native-130"]').click();
   await page.locator('.inspector code').filter({hasText:/^native-130$/}).waitFor();
   await page.getByLabel('頁面範圍').selectOption('all');
   await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
   }
   await page.getByLabel("流程連線範圍").selectOption("all");
   await page.locator('.react-flow__edge-textwrapper').filter({hasText:"Across native pages"}).locator('rect').click();
   await page.locator('.inspector code').filter({hasText:/^native-259$/}).waitFor();
   async function select(id){await page.getByLabel("搜尋畫面").fill(id);await page.locator(`button[title="${id}"]`).click();await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();}
   await select("react");await page.getByRole("button",{name:"▶ 操作呢個畫面",exact:true}).click();
   const live=page.frameLocator('iframe[data-screen="react"]');await live.getByLabel("Draft").fill("retained React state");await live.getByRole("button",{name:"Save",exact:true}).click();await live.locator("output").filter({hasText:/^retained React state$/}).waitFor();assert.equal(await live.locator("output").innerText(),"retained React state");
   await select("native-0");await page.locator('.inspector .flow-link').click();await page.locator('.inspector code').filter({hasText:/^native-259$/}).waitFor();
   await select("react");assert.equal(await live.getByLabel("Draft").inputValue(),"retained React state","filters and GPU view must not remount original React");
   for(const [label,view]of[["狀態圖","machine"],["畫面總覽","overview"]]){
    await page.getByRole("button",{name:label,exact:true}).click();
    await page.locator(`.review-workspace[data-view="${view}"][data-camera-ready="true"]`).waitFor();
    assert.equal(await live.getByLabel("Draft").inputValue(),"retained React state","graph/overview changes retain the original React instance");
   }
   await page.getByRole("button",{name:"自動播放 Demo",exact:true}).click();const demo=page.getByRole("region",{name:"Demo 播放"});await demo.getByLabel("Demo 播放速度").selectOption("0");
   await page.locator('.demo-player[data-status="complete"]').waitFor();assert.equal(await page.frameLocator('iframe[data-screen="journey"]').locator("output").innerText(),"player state","player keeps a continuing React session across confirmed states");
   await demo.getByRole("button",{name:"退出 Demo",exact:true}).click();await live.getByLabel("Draft").waitFor();assert.equal(await live.getByLabel("Draft").inputValue(),"retained React state");
   if(supported){await page.locator('.native-overview canvas').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
   await page.locator('.native-overview[data-status="fallback"]').waitFor();assert.equal(await live.getByLabel("Draft").inputValue(),"retained React state","GPU loss cannot discard an original app instance");}
   await select("native-259");await page.getByRole("button",{name:"▶ 操作呢個畫面",exact:true}).click();await page.frameLocator('iframe[data-screen="native-259"]').getByAltText("Synthetic native capture").waitFor();
   for(const failure of ["checksum","unavailable","texture"]){
    const fallback=await browser.newPage({viewport:{width:1512,height:982}});
    if(failure==="checksum")await fallback.route("**/atlas.png",route=>route.fulfill({contentType:"image/png",body:Buffer.from("changed capture bytes")}));
    else await fallback.addInitScript(failure=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==="webgl2"&&failure==="unavailable")return null;const context=original.call(this,type,...args);if(type==="webgl2"&&context&&failure==="texture")context.getError=()=>context.OUT_OF_MEMORY;return context}},failure);
    await fallback.goto(app.address);await fallback.locator('.native-overview[data-status="fallback"]').waitFor();
    await fallback.getByLabel("搜尋畫面").fill("react");await fallback.locator('button[title="react"]').click();
    await fallback.locator('.review-workspace[data-camera-ready="true"]').waitFor();
    await fallback.getByRole("button",{name:"▶ 操作呢個畫面",exact:true}).click();
    await fallback.locator('.review-workspace[data-camera-ready="true"][data-mode="interact"]').waitFor();
    const original=fallback.frameLocator('iframe[data-screen="react"]');
    await original.locator('html[data-review-ready="true"]').waitFor();
    await original.locator('body').evaluate(el=>{window.__events=[];for(const type of['input','change','click'])document.addEventListener(type,e=>window.__events.push({type,target:e.target.tagName,value:e.target.value}),true)});
    await original.getByLabel("Draft").fill("fallback works");
    await original.getByRole("button",{name:"Save",exact:true}).click();
    try { await original.locator("output").filter({hasText:/^fallback works$/}).waitFor({timeout:5000}); }
    catch(error){console.log(JSON.stringify({engine:engine.name(),failure,mode:await fallback.locator('.review-workspace').getAttribute('data-mode'),source:await original.locator('body').evaluate(el=>({html:el.innerHTML,events:window.__events,ready:document.documentElement.dataset.reviewReady}))}));throw error;}
    assert.equal(await original.locator("output").innerText(),"fallback works",`${failure} must preserve the original React renderer`);await fallback.close();
   }
   assert.deepEqual(errors,[]);console.log(`PASS ${engine.name()}: ${supported?'GPU native overview and context loss':'GPU unavailable; original fallback'}, real React state, graph/overview, cross-page flow, continuing Demo/player, checksum/unavailable/texture fallback`);
  }finally{await browser.close();}
 }
}finally{await app.close();}
