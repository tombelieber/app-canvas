import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
const { startCanvas } = await import(process.env.APP_CANVAS_TEST_PACKAGE ? pathToFileURL(join(process.env.APP_CANVAS_TEST_PACKAGE, "lib/server.mjs")) : "../lib/server.mjs");
const count = Number(process.env.APP_CANVAS_BUDGET_CASES || 260);
assert.ok(Number.isInteger(count) && count >= 260 && count <= 20000);
const liveOnly = process.env.APP_CANVAS_BUDGET_LIVE === "1";
const root = await mkdtemp(join(tmpdir(), "app-canvas-overview-budget-"));
let app, browser;
try {
  await writeFile(join(root, "canvas.config.mjs"), `
    const catalog=Array.from({length:${count}},(_,i)=>({id:'stress-'+i,title:'Source screen '+i,group:'app',viewport:{width:390,height:844}}));
    export default { title:'Large source DOM landscape',groups:[{id:'app'}],catalog,concurrency:6,
      journeys:catalog.map(s=>({id:s.id,kind:"case",title:s.title,entry:s.id,steps:[{title:s.title,screen:s.id,actions:[{type:"expect",selector:"h1",text:s.id}]}]})),
      preview(ctx){return {url:s=>ctx.canvasOrigin+'/source/'+s.id,handle(req,res,url){
        if(!url.pathname.startsWith('/source/'))return false;
        const id=url.pathname.slice(8);if(!catalog.some(s=>s.id===id)){res.writeHead(404);res.end();return true;}
        res.setHeader('Content-Type','text/html');
        res.end('<!doctype html><html data-review-ready="false"><head><style>body{margin:0;min-height:844px;background:#f9f4e8}h1{padding:20px}</style></head><body><h1>'+id+'</h1><button id="increment">Add</button><output>0</output><script>document.querySelector("button").onclick=()=>document.querySelector("output").value=String(Number(document.querySelector("output").value)+1);document.documentElement.dataset.reviewReady="true"</script></body></html>');return true;
      }}}};
  `);
  app = await startCanvas({ root, configPath: "canvas.config.mjs", port: 0, watchFiles: false, snapshots: !liveOnly });
  await app.firstBuild;
  assert.equal(app.getManifest().status, "ready");
  browser = await chromium.launch({ headless: true, args: ["--js-flags=--max-old-space-size=1024"] });
  const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
  // The fixture is immutable after firstBuild. Exclude the persistent source
  // event stream from the browser's network-idle completion signal.
  await page.route("**/events", route => route.abort());
  await page.goto(app.address);
  await page.locator('.review-workspace[data-live-ready="true"][data-camera-ready="true"]').waitFor({ timeout: 45000 });
  await page.waitForLoadState("networkidle");
  const overview = page.frameLocator("iframe[data-overview]");
  const initial = await overview.locator("[data-preview]").count();
  assert.ok((liveOnly ? initial === 0 : initial > 0 && initial <= 128), `retained ${initial} source DOM documents for ${count} cases`);
  assert.equal(await page.locator(".screen-frame").count(), count, "every registered case remains addressable");
  async function open(id) {
    await page.getByLabel("搜尋畫面").fill(id);
    await page.locator('[title="'+id+'"]').click();
    await page.getByRole("button", { name: "▶ 操作呢個畫面", exact: true }).click();
    await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
    const frame = page.frameLocator('iframe[data-screen="'+id+'"]');
    await frame.locator('html[data-review-ready="true"]').waitFor();
    await frame.getByRole("heading", { name: id, exact: true }).waitFor();
    return frame;
  }
  const last = await open("stress-"+(count-1));
  await last.getByRole("button", { name: "Add", exact: true }).click();
  await last.locator("output").filter({ hasText: /^1$/ }).waitFor();
  assert.equal(await last.locator("output").innerText(), "1");
  await open("stress-0");
  await open("stress-"+(count-1));
  assert.equal(await page.frameLocator('iframe[data-screen="stress-'+(count-1)+'"]').locator("output").innerText(), "1", "eviction must not discard retained original app edits");
  await page.waitForLoadState("networkidle");
  assert.ok(await overview.locator("[data-preview]").count() <= 128);
  assert.ok(await page.locator("iframe[data-screen]").count() <= 8);
  console.log(`PASS: all ${count} original source cases addressable; ${initial} passive documents at overview; bounded loading/eviction; final case opens and retained edits survive navigation.`);
} finally { await browser?.close(); await app?.close(); await rm(root, { recursive: true, force: true }); }
