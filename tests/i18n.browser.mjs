import assert from 'node:assert/strict';
import { mkdir,readFile } from 'node:fs/promises';
import { chromium,webkit } from 'playwright';
import { languages } from '../lib/locales.mjs';
import { startCanvas } from '../lib/server.mjs';
const app=await startCanvas({port:0,watchFiles:false,config:{title:'Locale qualification',groups:[{id:'main',title:'App content'}],catalog:[{id:'form',group:'main',title:'Original app title',outcome:'success'}],journeys:[{id:'draft',title:'Original flow',entry:'form',steps:[{screen:'form',title:'Fill draft',actions:[{type:'fill',selector:'input',value:'played'}]},{screen:'form',title:'Check draft',actions:[{type:'expect',selector:'input',value:'played'}]}]}],preview:async({canvasOrigin})=>({url:()=>`${canvasOrigin}/form`,handle(_req,res,url){if(url.pathname!=='/form')return false;res.setHeader('Content-Type','text/html');res.end('<html data-review-ready="true"><body><h1>Original application content</h1><input aria-label="Draft"></body></html>');return true;}})}});
try{
 await app.firstBuild;
 for(const [name,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch();
  try{
   const page=await browser.newPage({viewport:{width:1180,height:820},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(app.address);await page.locator('.review-workspace[data-live-ready="true"]').waitFor();
   assert.equal(await page.locator('html').getAttribute('lang'),'en');
   await page.getByRole('button',{name:'Interact',exact:true}).click();
   const input=page.frameLocator('iframe[data-screen="form"]').getByLabel('Draft');await input.fill('keep this draft');
   await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
   await page.evaluate(()=>new Promise(resolve=>{let last='',same=0;function tick(){const next=document.querySelector('.react-flow__viewport').getAttribute('style');same=next===last?same+1:0;last=next;if(same>=8)resolve();else requestAnimationFrame(tick)}tick()}));
   const before=await page.locator('.react-flow__viewport').getAttribute('style');
   await page.locator('iframe[data-screen="form"]').evaluate(el=>el.dataset.identity='original');
   for(const locale of languages){
    await page.locator('.language-picker:visible').selectOption(locale);
    const copy=JSON.parse(await readFile(new URL(`../ui/locales/${locale}.json`,import.meta.url)));
    await page.locator(`html[lang="${locale}"]`).waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'),locale);
    assert.equal(await page.locator('.language-picker:visible').getAttribute('aria-label'),copy.Language);
    await page.getByRole('button',{name:copy.Panels,exact:true}).waitFor();
    assert.equal(await input.inputValue(),'keep this draft');
    assert.equal(await page.locator('iframe[data-screen="form"]').getAttribute('data-identity'),'original');
    assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'),before);
    assert.ok((await page.locator('.workspace-brand').innerText()).includes('Locale qualification'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} ${locale} landscape overflow`);
   }
   assert.equal(await page.evaluate(()=>localStorage.getItem('app-canvas:locale')),'nl');
   await page.reload();await page.locator('.language-picker:visible').waitFor();
   // A visible picker can precede React's document-language effect in WebKit.
   // Wait for the actual restored state, retaining the same persistence contract.
   await page.locator('html[lang="nl"]').waitFor();
   assert.equal(await page.locator('.language-picker:visible').inputValue(),'nl');
   assert.equal(await page.locator('html').getAttribute('lang'),'nl');
   await page.locator('.language-picker:visible').selectOption('en');
   await page.getByRole('button',{name:'Start Demo',exact:true}).click();
   await page.locator('.demo-player').waitFor();
   await page.locator('.language-picker:visible').selectOption('ja');
   await page.locator('.demo-player[data-status="complete"]').waitFor();
   assert.equal(await page.locator('.demo-caption').innerText(),'✓ デモ完了');
   await page.getByRole('button',{name:'デモを終了',exact:true}).click();
   for(const width of [1024,736,390,320]){await page.setViewportSize({width,height:820});await page.locator('.language-picker:visible').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} ${width}px overflow`);}
   assert.deepEqual(errors,[]);await mkdir('.artifacts/launch',{recursive:true});await page.screenshot({path:`.artifacts/launch/viewer-${name}.png`});
   console.log(`PASS ${name}: English default, all 11 locales, persistence, draft/frame/camera preservation, live playback switch, 320–1180px.`);
  }finally{await browser.close();}
 }
}finally{await app.close();}
