import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
import{chromium,webkit}from'./locale-browser.mjs';import{serveStatic}from'./serve-static.mjs';import{pagePath}from'../launch/content.mjs';
const site=await serveStatic(process.env.APP_CANVAS_STATIC_DIR||'.artifacts/site','/app-canvas/'),origin=new URL(site.url).origin;
const copies=JSON.parse(await readFile(new URL('../launch/cloud-locales.json',import.meta.url)));
try{for(const[engine,type,locale]of[['chromium',chromium,'en'],['webkit',webkit,'zh-TW']]){
 const browser=await type.launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844}});let requests=0,offline=true;
  await page.route('https://app-canvas-services.vickyai-tech.workers.dev/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   if(path==='/capture'){await route.fulfill({status:503,body:'{}'});return;}
   requests++;if(offline){offline=false;await route.abort();return;}
   const response=await page.request.fetch((process.env.CLOUD_TEST_URL||'http://127.0.0.1:6167')+path,{method:req.method(),headers:{'Content-Type':'application/json',Origin:origin},data:req.postData()});
   await route.fulfill({response});
  });
  await page.goto(origin+pagePath(locale,"release"));const copy=copies[locale],email=`browser-qualification-${crypto.randomUUID()}@example.com`;
  const form=page.locator('#waitlist-form');await form.locator('[name=email]').fill(email);await form.getByRole('button',{name:copy.join,exact:true}).click();assert.equal(requests,0,'no submission without explicit consent');
  await form.locator('[name=consent]').check();await form.getByRole('button',{name:copy.join,exact:true}).click();await form.getByRole('status').filter({hasText:copy.failure}).waitFor();assert.equal(await form.getByRole('button').isEnabled(),true);
  await form.getByRole('button',{name:copy.join,exact:true}).click();await form.getByRole('status').filter({hasText:copy.success}).waitFor();const token=await form.locator('.removal-code code').innerText();assert.match(token,/^[a-f0-9]{64}$/);
  await page.locator('#cloud details summary').click();const removal=page.locator('#remove-form');await removal.locator('[name=email]').fill(email);await removal.locator('[name=token]').fill(token);await removal.getByRole('button',{name:copy.remove,exact:true}).click();await removal.getByRole('status').filter({hasText:copy.removed}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log(`PASS ${engine} ${locale}: consent, failure/retry, real Worker/D1 signup, removal code and self-removal from launch UI.`);
 }finally{await browser.close();}
}}finally{await site.close();}
