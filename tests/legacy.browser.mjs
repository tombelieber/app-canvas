import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startCanvas } from "../lib/server.mjs";
const app=await startCanvas({port:0,watchFiles:false,config:{title:"Legacy cached project",groups:[{id:"app",title:"Pages"}],catalog:[{id:"home",title:"Home",group:"app"}],preview:async({canvasOrigin})=>({url:()=>canvasOrigin+"/frame",handle(req,res,url){if(url.pathname!=="/frame")return false;res.setHeader("Content-Type","text/html");res.end('<!doctype html><html data-review-ready="true"><head></head><body><button id="live">Legacy app</button></body></html>');return true;}})}});
const browser=await chromium.launch();
try{
 await app.firstBuild;
 const page=await browser.newPage();
 await page.route(/\/project\.json(?:\?.*)?$/,async route=>{
  const response=await route.fetch(), project=await response.json();
  delete project.pages;
  for(const s of project.catalog){delete s.pageId;delete s.feature;}
  await route.fulfill({response,json:project});
 });
 await page.route("**/events",async route=>{
  const manifest=structuredClone(app.getManifest());
  for(const screen of Object.values(manifest.screens)){delete screen.domUrl;delete screen.sharedUrl;}
  await route.fulfill({contentType:"text/event-stream",body:`data: ${JSON.stringify(manifest)}\n\n`});
 });
 const failure=page.waitForEvent("pageerror").then(e=>({error:e.message}));
 await page.goto(app.address);
 const result=await Promise.race([failure,page.locator('.review-workspace[data-live-ready="true"]').waitFor({timeout:10000}).then(()=>({ready:true}))]);
 assert.equal(result.ready,true,`new runtime must accept cached legacy project metadata: ${JSON.stringify(result)}`);
 await page.getByRole("button",{name:"▶ 操作 App",exact:true}).click();
 await page.frameLocator('iframe[data-screen="home"]').locator("#live").waitFor();
 console.log("PASS: previous public project metadata remains operable through the new runtime during a cached upgrade.");
}finally{await browser.close();await app.close();}
