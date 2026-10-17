import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startCanvas } from "../lib/server.mjs";
const root = await mkdtemp(join(tmpdir(), "app-canvas-readiness-"));
let app;
try {
  await writeFile(join(root, "canvas.config.mjs"), `export default {
    title:'Deferred original UI',groups:[{id:'app'}],catalog:[{id:'deferred',title:'Deferred source screen',group:'app'}],
    preview(ctx){return {url:()=>ctx.canvasOrigin+'/source',handle(req,res,url){if(url.pathname!='/source')return false;res.setHeader('Content-Type','text/html');res.end('<!doctype html><html data-review-ready="false"><body><h1>Loading source UI</h1><script>setTimeout(()=>{document.querySelector("h1").textContent="Ready original UI";document.documentElement.dataset.reviewReady="true"},600)</script></body></html>');return true;}}}
  };`);
  app = await startCanvas({ root, configPath: "canvas.config.mjs", port: 0, watchFiles: false });
  await app.firstBuild;
  const manifest = app.getManifest();
  assert.equal(manifest.status, "ready");
  const response = await fetch(manifest.screens.deferred.sharedUrl);
  const document = await response.json();
  assert.ok(document.html.includes("Ready original UI"), "the passive document must contain the ready source UI");
  assert.ok(!document.html.includes("Loading source UI"), "loading is not a successful captured screen");
  console.log("PASS: false readiness waits for the original UI before source DOM capture.");
} finally { await app?.close(); await rm(root, { recursive: true, force: true }); }
