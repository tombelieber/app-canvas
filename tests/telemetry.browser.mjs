import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';import { tmpdir } from 'node:os';import { join } from 'node:path';
import { chromium,webkit } from 'playwright';
import { startCanvas } from '../lib/server.mjs';import { createTelemetry } from '../lib/telemetry.mjs';
const home=await mkdtemp(join(tmpdir(),'canvas-analytics-')),sent=[];
const telemetry=await createTelemetry({home,env:{},version:'0.12.0',surface:'qualification',fetcher:async(_url,options)=>{sent.push(JSON.parse(options.body));return{ok:true};}});
const app=await startCanvas({port:0,watchFiles:false,telemetry,config:{title:'Private app title must never be captured',groups:[{id:'app'}],catalog:[{id:'private-screen',title:'Private screen title',group:'app'}],preview:async({canvasOrigin})=>({url:()=>canvasOrigin+'/source',handle(_q,res,url){if(url.pathname!='/source')return false;res.setHeader('Content-Type','text/html');res.end('<html data-review-ready="true"><body>Private app content</body></html>');return true;}})}});
try{
 await app.firstBuild;
 for(const [name,type]of [['chromium',chromium],['webkit',webkit]]){
  await telemetry.setEnabled(true);const browser=await type.launch();
  try{
   const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const received=page.waitForResponse(r=>new URL(r.url()).pathname==='/telemetry'&&r.status()===204);await page.goto(app.address);await received;
   await page.getByRole('button',{name:'Panels',exact:true}).click();const toggle=page.getByLabel('Anonymous usage analytics',{exact:true});await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/telemetry/preference'&&r.status()===204),toggle.uncheck()]);
   assert.equal(telemetry.config().enabled,false);const count=sent.length;
   await page.reload();await page.locator('.language-picker').waitFor();await page.locator('.language-picker').selectOption('ja');assert.equal(sent.length,count);
   await page.getByRole('button',{name:'パネル',exact:true}).click();await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/telemetry/preference'&&r.status()===204),page.getByLabel('匿名の利用状況分析',{exact:true}).check()]);assert.equal(telemetry.config().enabled,true);
   assert.equal((await fetch(app.address+'/telemetry/preference',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:'{"enabled":false}'})).status,403);assert.equal(telemetry.config().enabled,true);
   const dnt=await browser.newPage();await dnt.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{value:'1'}));let requests=0;dnt.on('request',r=>{if(new URL(r.url()).pathname==='/telemetry')requests++;});await dnt.goto(app.address);await dnt.locator('.language-picker').waitFor();await dnt.getByRole('button',{name:'Panels',exact:true}).click();assert.equal(await dnt.getByLabel('Anonymous usage analytics',{exact:true}).isChecked(),false);assert.equal(await dnt.getByLabel('Anonymous usage analytics',{exact:true}).isEnabled(),false);assert.equal(requests,0);
   assert.ok(!JSON.stringify(sent).includes('Private'));assert.ok(!JSON.stringify(sent).includes('private-screen'));assert.ok(sent.every(e=>e.properties.surface==='qualification'));assert.deepEqual(errors,[]);
   console.log(`PASS ${name}: real viewer/proxy capture, persistent off/on, origin guard, DNT, no source data.`);
  }finally{await browser.close();}
 }
}finally{await app.close();await rm(home,{recursive:true,force:true});}
