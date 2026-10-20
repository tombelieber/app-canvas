import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';import { tmpdir } from 'node:os';import { join } from 'node:path';
import { chromium,webkit } from 'playwright';
import { startCanvas } from '../lib/server.mjs';import { createTelemetry } from '../lib/telemetry.mjs';
const home=await mkdtemp(join(tmpdir(),'canvas-analytics-')),sent=[];
const telemetry=await createTelemetry({home,env:{},version:'0.12.0',surface:'qualification',fetcher:async(_url,options)=>{sent.push(JSON.parse(options.body));return{ok:true};}});
const app=await startCanvas({port:0,watchFiles:false,telemetry,config:{title:'Private app title must never be captured',groups:[{id:'app'}],catalog:[{id:'private-screen',title:'Private screen title',group:'app'}],preview:async({canvasOrigin})=>({url:()=>canvasOrigin+'/source',handle(_q,res,url){if(url.pathname!='/source')return false;res.setHeader('Content-Type','text/html');res.end('<html data-review-ready="true"><body>Private app content</body></html>');return true;}})}});
try{
 await app.firstBuild;
 for(const [name,type]of [['chromium',chromium],['webkit',webkit]]){
  await telemetry.setEnabled(true);await telemetry.setCohortClass('internal_test');const browser=await type.launch();
  try{
   const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const received=page.waitForResponse(r=>new URL(r.url()).pathname==='/telemetry'&&r.status()===204),request=page.waitForRequest(r=>new URL(r.url()).pathname==='/telemetry');await page.goto(app.address);await received;
   const payload=(await request).postDataJSON();assert.equal(payload.properties.cohort_class,'internal_test');assert.equal(sent.at(-1).properties.cohort_class,'internal_test');
   assert.equal(payload.properties.environment,'qualification');assert.equal(sent.at(-1).properties.environment,'qualification');
   await page.getByRole('button',{name:'Panels',exact:true}).click();const toggle=page.getByLabel('Anonymous usage analytics',{exact:true});await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/telemetry/preference'&&r.status()===204),toggle.uncheck()]);
   assert.equal(telemetry.config().enabled,false);const count=sent.length;
   await page.reload();await page.locator('.language-picker').waitFor();await page.locator('.language-picker').selectOption('ja');assert.equal(sent.length,count);
   await page.getByRole('button',{name:'パネル',exact:true}).click();await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/telemetry/preference'&&r.status()===204),page.getByLabel('匿名の利用状況分析',{exact:true}).check()]);assert.equal(telemetry.config().enabled,true);
   assert.equal((await fetch(app.address+'/telemetry/preference',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:'{"enabled":false}'})).status,403);assert.equal(telemetry.config().enabled,true);
   const dnt=await browser.newPage();await dnt.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{value:'1'}));let requests=0;dnt.on('request',r=>{if(new URL(r.url()).pathname==='/telemetry')requests++;});await dnt.goto(app.address);await dnt.locator('.language-picker').waitFor();await dnt.getByRole('button',{name:'Panels',exact:true}).click();assert.equal(await dnt.getByLabel('Anonymous usage analytics',{exact:true}).isChecked(),false);assert.equal(await dnt.getByLabel('Anonymous usage analytics',{exact:true}).isEnabled(),false);assert.equal(requests,0);
   assert.ok(!JSON.stringify(sent).includes('Private'));assert.ok(!JSON.stringify(sent).includes('private-screen'));assert.ok(sent.every(e=>e.properties.surface==='qualification'));assert.deepEqual(errors,[]);
   const landing=await browser.newPage(),landingEvents=[];
   await landing.route('https://app-canvas-services.vickyai-tech.workers.dev/**',route=>{assert.ok(route.request().url().endsWith('/capture'));landingEvents.push(route.request().postDataJSON());return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});});
   const cloud=await readFile(new URL('../launch/cloud.js',import.meta.url),'utf8');
   await landing.route('https://landing.test/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><body data-page="product"><section id="cloud" data-locale="en" data-version="0.14.0"></section><script id="cloud-copy" type="application/json">{}</script><form id="waitlist-form"><p role="status"></p><button>Join</button></form><form id="remove-form"><p role="status"></p><button>Remove</button></form><input id="analytics-choice" type="checkbox"><a href="#" data-action="start">Start</a><script>${cloud}</script></body>`}));
   const landingRequest=landing.waitForRequest(request=>request.url().endsWith('/capture'));await landing.goto('https://landing.test/');
   const landingPayload=(await landingRequest).postDataJSON();assert.equal(landingPayload.properties.environment,'production');assert.equal(landingPayload.properties.cohort_class,'unknown');assert.equal(landingPayload.properties.surface,'landing');
   await landing.getByRole('checkbox').uncheck();await landing.getByRole('link',{name:'Start',exact:true}).click();await landing.reload();await landing.getByRole('checkbox').waitFor();assert.equal(await landing.getByRole('checkbox').isChecked(),false);assert.equal(landingEvents.length,1,'persisted landing opt-out suppresses the CTA and reload events');
   console.log(`PASS ${name}: real viewer/proxy and landing environment/audience, persistent off/on, origin guard, DNT, no source data.`);
  }finally{await browser.close();}
 }
}finally{await app.close();await rm(home,{recursive:true,force:true});}
