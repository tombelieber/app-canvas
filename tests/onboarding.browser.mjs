import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), "app-canvas-onboarding-"));
let app;
try {
  const pack = JSON.parse((await exec("npm", ["pack", "--json", "--pack-destination", root])).stdout)[0];
  const project = join(root, "project");
  await cp("examples/react-vite", project, { recursive: true });
  await exec("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-dev", join(root, pack.filename)], { cwd: project, maxBuffer: 1024 * 1024 });
  const installed = join(project, "node_modules/@tombelieber/app-canvas");
  const { startCanvas } = await import(pathToFileURL(join(installed, "lib/server.mjs")));
  const { loadProject } = await import(pathToFileURL(join(installed, "lib/config.mjs")));
  const { checkRouteCoverage } = await import(pathToFileURL(join(installed, "lib/routes.mjs")));
  const configPath = "ui-review/canvas.config.mjs";
  const config = await loadProject(configPath, project);
  await assert.rejects(() => checkRouteCoverage({ ...config, catalog: config.catalog.filter((s) => s.path !== "/settings") }, project), /Pages missing/);
  const source = join(project, "src/App.jsx"), before = await readFile(source, "utf8");
  await writeFile(source, before.replace("</Routes>", '<Route path="/new" element={<Tasks />} /></Routes>'));
  await assert.rejects(() => loadProject(configPath, project), /Route inventory changed/);
  await writeFile(source, before);
  app = await startCanvas({ root: project, configPath, port: 0, watchFiles: true });
  const proof = await app.verify();
  assert.equal(proof.total, 6);
  assert.equal(proof.interactionsVerified, true);
  // Verify the same page code actually changes both the thumbnail and live UI.
  const originalImage = Buffer.from(await (await fetch(new URL(app.getManifest().screens.tasks.image, app.address))).arrayBuffer());
  const abort = new AbortController();
  const stream = await fetch(`${app.address}/events`, { signal: abort.signal });
  const reader = stream.body.getReader();
  const changed = (async () => {
    let pending = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw Error("Source event stream closed");
      pending += new TextDecoder().decode(value);
      const events = pending.split("\n\n"); pending = events.pop();
      for (const event of events) {
        const next = JSON.parse(event.slice(6));
        if (next.revision > proof.revision && next.status === "ready") return next;
      }
    }
  })();
  const timer = setTimeout(() => abort.abort(), 20000);
  let updated;
  try {
    await writeFile(source, before.replace("<h1>Tasks</h1>", "<h1>Edited in application source</h1>"));
    updated = await changed;
  } finally { clearTimeout(timer); abort.abort(); }
  const nextImage = Buffer.from(await (await fetch(new URL(updated.screens.tasks.image, app.address))).arrayBuffer());
  assert.ok(!originalImage.equals(nextImage), "source update must regenerate the overview");
  const { chromium } = await import(pathToFileURL(join(installed, "node_modules/playwright/index.mjs"))).catch(() => import("playwright"));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(updated.screens.tasks.url);
    await page.getByRole("heading", { name: "Edited in application source" }).waitFor();
    const rejected = await page.evaluate(async () => {
      try { await fetch("https://unmocked.example.test/private"); return false; } catch { return globalThis.__appCanvas.requests.length === 1; }
    });
    assert.equal(rejected, true, "unknown external requests fail closed");
  } finally { await browser.close(); }
  console.log("PASS: fresh packaged install → 2 real routes / 6 states → save/navigation/add/retry/reset → missing-route failure → source refresh → unknown request denied.");
} finally {
  await app?.close();
  await rm(root, { recursive: true });
}
