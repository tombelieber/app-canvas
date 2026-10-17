import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile), cli = process.env.APP_CANVAS_TEST_CLI || resolve("bin/app-canvas.mjs");
const root = await mkdtemp(join(tmpdir(), "app-canvas-complete-browser-"));
try {
  await mkdir(join(root, "source"));
  await writeFile(join(root, "source/App.mjs"), `export function render(denied) {
    return denied ? '<main><h1>Login failed</h1><button>Retry</button></main>' : '<main><h1>Login</h1><input aria-label="Username"></main>';
  }`);
  const run = (...args) => exec(process.execPath, [cli, ...args], { cwd: root, timeout: 90000, maxBuffer: 1024 * 1024 });
  await run("discover", "--source-root", "source", "--out", ".artifacts/inventory.json");
  const path = join(root, ".artifacts/inventory.json"), inventory = JSON.parse(await readFile(path, "utf8"));
  inventory.items = [
    { id: "login", kind: "screen", sources: ["App.mjs"], cases: ["idle"] },
    { id: "denied", kind: "state", sources: ["App.mjs"], cases: ["denied"] },
  ];
  inventory.reviews = inventory.obligations.map(item => ({ id: item.id, items: [item.outcome === "true" ? "denied" : "login"] }));
  await writeFile(path, JSON.stringify(inventory));
  await writeFile(join(root, "canvas.config.mjs"), `
    import assert from 'node:assert/strict';
    import { render } from './source/App.mjs';
    const catalog = ['idle', 'denied'].map(id => ({ id, title: id, group: 'app', viewport: {width:390,height:844} }));
    export default {
      title: 'Complete original UI', port: 0, groups: [{id:'app'}], catalog,
      sourceCoverage: {inventory: '.artifacts/inventory.json'},
      coverage: {requireSourceInventory:false,requireAllCases:false,requireConnected:false},
      flows: [{from:'idle',to:'denied',label:'Denied fixture',kind:'condition'}],
      journeys: catalog.map(item => ({id:item.id+'-case',kind:'case',title:item.title,entry:item.id,steps:[{title:'State visible',screen:item.id,actions:[{type:'expect',selector:'h1',text:item.id==='denied'?'Login failed':'Login'}]}]})),
      preview(ctx) {return {
        url: item => ctx.canvasOrigin+'/app/'+item.id,
        handle(req,res,url) {
          if (!url.pathname.startsWith('/app/')) return false;
          res.setHeader('Content-Type','text/html');
          res.end('<!doctype html><html data-review-ready="true"><head><meta charset="utf-8"></head><body>'+render(url.pathname.endsWith('/denied'))+'</body></html>');
          return true;
        }
      }},
      async verify({browser,preview,sourceCoverage}) {
        const page = await browser.newPage(), cases = [];
        try {
          for (const item of catalog) {
            await page.goto(preview.url(item));
            assert.equal(await page.locator('h1').innerText(), item.id==='denied'?'Login failed':'Login');
            cases.push({id:item.id,runtime:'web',buildId:'original-source-render',fixtureId:item.id,assertions:[{id:'expected-login-state',passed:true,sources:sourceCoverage.requiredEvidence[item.id].map(item=>item.id)}]});
          }
          return {sourceDigest:sourceCoverage.digest,cases};
        } finally {await page.close();}
      }
    };
  `);
  const result = await run("--complete", "--source-root", "source");
  assert.match(result.stdout, /PASS: source population verified, 2 cases/);
  await assert.rejects(() => run("--complete", "--source-root", "."), error => error.code === 1 && /source.*root.*match/i.test(error.stderr));
  inventory.items.pop();
  inventory.reviews = inventory.reviews.filter(item => !item.items.includes("denied"));
  await writeFile(path, JSON.stringify(inventory));
  const configPath = join(root, "canvas.config.mjs");
  const config = await readFile(configPath, "utf8");
  await writeFile(configPath, config.replace("['idle', 'denied']", "['idle']").replace("flows: [{from:'idle',to:'denied',label:'Denied fixture',kind:'condition'}]", "flows: []"));
  await assert.rejects(() => run("--complete", "--source-root", "source"), error => error.code === 1 && /source obligations unreviewed/.test(error.stderr));
  console.log("PASS: public --complete renders both original states, rejects a different source scope, and rejects omitted error-state accounting");
} finally { await rm(root, { recursive: true, force: true }); }
