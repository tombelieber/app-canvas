import assert from "node:assert/strict";
import { chromium } from "./locale-browser.mjs";
import { startCanvas } from "../lib/server.mjs";
const config = {
  title: "Queue proof", groups: [{ id: "app" }],
  catalog: ["home", "failed", "saved"].map(id=>({id,title:id,group:"app",outcome:id==="failed"?"failure":id==="saved"?"success":"neutral"})),
  flows: [{ from:"home",to:"failed",label:"Fail" },{from:"failed",to:"saved",label:"Retry",kind:"recovery"}],
  journeys: [
    {id:"recovery",title:"Recovery",entry:"home",steps:[
      {title:"Fail",screen:"failed",actions:[{type:"click",selector:"#fail"},{type:"expect",selector:"output",text:"Failed"}]},
      {title:"Retry",screen:"saved",actions:[{type:"fill",selector:"input",value:"kept draft"},{type:"click",selector:"#save"},{type:"expect",selector:"output",text:"kept draft"}]},
    ]},
    {id:"fresh-case",kind:"case",title:"Fresh case",entry:"home",steps:[{title:"Fresh session",screen:"home",actions:[{type:"expect",selector:"input",value:""},{type:"expect",selector:"output",text:"Initial"}]}]},
    {id:"saved-case",kind:"case",title:"Saved case",entry:"saved",steps:[{title:"Saved fixture",screen:"saved",actions:[{type:"expect",selector:"h1",text:"saved"}]}]},
  ],
  preview: async ({canvasOrigin})=>({url:s=>`${canvasOrigin}/frame?id=${s.id}`,handle(req,res,url){
    if(url.pathname!=="/frame")return false;
    res.setHeader("Content-Type","text/html");res.end(`<!doctype html><html data-review-ready="true"><head></head><body><h1>${url.searchParams.get("id")}</h1><input aria-label="Draft"><button id="fail" onclick="document.querySelector('output').textContent='Failed'">Fail</button><output>Initial</output><div style="height:1600px">Long real page</div><button id="save" onclick="document.querySelector('output').textContent=document.querySelector('input').value">Save</button></body></html>`);return true;
  }}),
};
const app=await startCanvas({config,port:0,watchFiles:false}), browser=await chromium.launch({headless:true});
try {
  await app.firstBuild;
  const page=await browser.newPage({viewport:{width:1512,height:982}});
  await page.goto(app.address);
  await page.locator('.review-workspace[data-live-ready="true"]').waitFor();
  if (!await page.locator('select[aria-label="播放流程"]').isVisible()) await page.getByRole("button", { name: "開啟流程控制", exact: true }).click();
  await page.locator('select[aria-label="播放流程"]').selectOption("__all__");
  await page.getByRole("button",{name:"單步",exact:true}).click();
  await page.locator('.journey-panel[data-status="paused"][data-step="1"]').waitFor();
  assert.equal(await page.locator('.inspector code').innerText(),"failed");
  assert.equal(await page.locator('iframe[data-screen="journey"]').evaluate(el=>parseFloat(el.style.height)),844,"whole-set playback uses the native viewport, even in a full-page overview");
  await page.getByRole("button",{name:"單步",exact:true}).click();
  await page.locator('.journey-panel[data-status="paused"][data-finished="1"]').waitFor();
  assert.equal(await page.locator('.inspector code').innerText(),"saved");
  assert.equal(await page.frameLocator('iframe[data-screen="journey"]').locator('input').inputValue(),"kept draft","one flow preserves its draft");
  assert.ok(await page.frameLocator('iframe[data-screen="journey"]').locator('#save').evaluate(el=>el.getBoundingClientRect().top < innerHeight),"playback reveals the operated control inside its native viewport");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollTop),0,"revealing an action must not scroll the host canvas");
  await page.getByLabel("播放速度").selectOption("0");
  await page.getByRole("button",{name:"▶ 播放",exact:true}).click();
  await page.locator('.journey-panel[data-status="complete"][data-finished="3"]').waitFor();
  await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
  assert.equal(await page.locator('.inspector code').innerText(),"saved");
  await page.getByRole("button",{name:"重播",exact:true}).click();
  await page.locator('.journey-panel[data-status="complete"][data-finished="3"]').waitFor();
  // Preserve the selected path while showing its neighboring bad/recovery branch.
  await page.getByRole("button",{name:"狀態圖",exact:true}).click();
  await page.locator('select[aria-label="播放流程"]').selectOption("recovery");
  await page.getByLabel("顯示其他分支").check();
  assert.equal(await page.locator('.screen-frame[data-outcome="failure"]').count(),1);
  await page.getByRole("button",{name:"單步",exact:true}).click();
  await page.locator('.journey-panel[data-status="paused"][data-step="1"]').waitFor();
  await page.getByLabel("顯示其他分支").uncheck();
  await page.locator('.inspector .flow-link').filter({hasText:"Retry"}).click();
  await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
  assert.equal(await page.locator('.inspector code').innerText(),"saved");
  assert.equal(await page.locator('.journey-panel').getAttribute('data-status'),"idle","manual navigation exits the running session");
  console.log("PASS: full branching graph, single-step across queue boundaries, fresh per-case sessions, replay, neighboring branches and next-flow camera navigation.");
}finally{await browser.close();await app.close();}
