import assert from "node:assert/strict";
import { chromium } from "./locale-browser.mjs";
import { startCanvas } from "../lib/server.mjs";
import { verifyJourneys } from "../lib/verify.mjs";
const journeys = [{id:"replace-file",title:"Replace file",entry:"upload",steps:[{screen:"upload",title:"Use the new mapping",actions:[
  {type:"file",selector:"#file",asset:"./sample.csv",name:"synthetic.csv",mime:"text/csv",replaces:"#map-form"},
  {type:"click",selector:"#map-form button"},{type:"expect",selector:"output",text:"Fresh mapping",timeout:1000},
]}]}];
const config={title:"Async file proof",groups:[{id:"app"}],catalog:[{id:"upload",title:"Upload",group:"app"}],journeys,
preview:async({canvasOrigin})=>({url:()=>canvasOrigin+"/frame",handle(req,res,url){
 if(url.pathname==="/sample.csv"){res.end("date,description\n2026-10-16,Synthetic\n");return true;}
 if(url.pathname!=="/frame")return false;
 res.setHeader("Content-Type","text/html");res.end(`<!doctype html><html data-review-ready="true"><head></head><body><input id="file" type="file"><div id="map-form"><button onclick="document.querySelector('output').textContent='Stale mapping'">Preview old file</button></div><output></output><script>
 document.querySelector('#file').onchange=async()=>{
   await new Promise(resolve=>setTimeout(resolve,200));
   const next=document.createElement('div');next.id='map-form';
   next.innerHTML='<button>Preview new file</button>';
   next.querySelector('button').onclick=()=>document.querySelector('output').textContent='Fresh mapping';
   document.querySelector('#map-form').replaceWith(next);
 };
 </script></body></html>`);return true;
}})};
const app=await startCanvas({config,port:0,watchFiles:false}),browser=await chromium.launch({headless:true});
try{await app.firstBuild;const page=await browser.newPage();await page.goto(app.address);await page.locator('.review-workspace[data-live-ready="true"]').waitFor();await verifyJourneys({page,journeys});console.log("PASS: file replacement waits for the new DOM generation, rather than clicking the still-visible old form.");}finally{await browser.close();await app.close();}
