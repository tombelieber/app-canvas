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
let browser;
try {
  const packs = JSON.parse((await exec("npm", ["pack", "--json", "--pack-destination", root])).stdout);
  const pack = Array.isArray(packs) ? packs[0] : packs["@tombelieber/app-canvas"];
  const project = join(root, "project");
  await cp("examples/react-vite", project, { recursive: true });
  await exec("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-dev", join(root, pack.filename)], { cwd: project, maxBuffer: 1024 * 1024 });
  const installed = join(project, "node_modules/@tombelieber/app-canvas");
  const { startCanvas } = await import(pathToFileURL(join(installed, "lib/server.mjs")));
  const { loadProject } = await import(pathToFileURL(join(installed, "lib/config.mjs")));
  const { checkRouteCoverage } = await import(pathToFileURL(join(installed, "lib/routes.mjs")));
  const configPath = "ui-review/canvas.config.mjs";
  const config = await loadProject(configPath, project);
  // Exercise the shipped export and guard through the installed CLI, not an
  // import into the tool checkout. This stays separate from the legacy example.
  const fingerprintScript = "import { inventorySources } from '@tombelieber/app-canvas/inventory'; console.log(JSON.stringify(await inventorySources(process.cwd(), ['src'])));";
  const files = JSON.parse((await exec(process.execPath, ["--input-type=module", "-e", fingerprintScript], { cwd: project })).stdout);
  const inventory = { version: 1, files, items: ["tasks", "tasks-empty", "tasks-loading", "tasks-error", "settings", "settings-denied"].map(id => ({ id, kind: "state", sources: files.map(f => f.path), cases: [id] })) };
  await writeFile(join(project, "ui-review/inventory.json"), JSON.stringify(inventory));
  await writeFile(join(project, "ui-review/strict.config.mjs"), `import base from './canvas.config.mjs'; export default { ...base, coverage: { requireSourceInventory: true }, sourceCoverage: { roots: ['src'], inventory: 'ui-review/inventory.json' } };`);
  const cli = join(installed, "bin/app-canvas.mjs");
  const strictArgs = [cli, "--config", "ui-review/strict.config.mjs", "--check"];
  assert.match((await exec(process.execPath, strictArgs, { cwd: project })).stdout, /6 source inventory items mapped/);
  inventory.items.pop();
  await writeFile(join(project, "ui-review/inventory.json"), JSON.stringify(inventory));
  await assert.rejects(() => exec(process.execPath, strictArgs, { cwd: project }), error => error.code === 1 && /settings-denied/.test(error.stderr));
  inventory.items.push({ id: "settings-denied", kind: "state", sources: files.map(f => f.path), cases: ["settings-denied"] });
  await writeFile(join(project, "ui-review/inventory.json"), JSON.stringify(inventory));
  await assert.rejects(() => checkRouteCoverage({ ...config, catalog: config.catalog.filter((s) => s.path !== "/settings") }, project), /Pages missing/);
  const source = join(project, "src/App.jsx"), before = await readFile(source, "utf8");
  await writeFile(source, before.replace("</Routes>", '<Route path="/new" element={<Tasks />} /></Routes>'));
  await assert.rejects(() => loadProject(configPath, project), /Route inventory changed/);
  await writeFile(source, before);
  app = await startCanvas({ root: project, configPath, port: 0, watchFiles: true });
  const proof = await app.verify();
  assert.equal(proof.total, 6);
  assert.equal(proof.interactionsVerified, true);
  // Keep the canvas open: source edits must refresh its mounted real UI.
  const { chromium } = await import(pathToFileURL(join(installed, "node_modules/playwright/index.mjs"))).catch(() => import("playwright"));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(app.address);
  await page.getByRole("button", {name:"▶ 操作 App",exact:true}).click();
  const frame = page.frameLocator('iframe[data-screen="tasks"]');
  await frame.getByRole("heading", { name: "Tasks", exact: true }).waitFor();
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
  assert.ok(updated.revision > proof.revision);
  await frame.getByRole("heading", { name: "Edited in application source" }).waitFor();
  assert.equal(await page.locator(".screen-frame img").count(), 0);
    const rejected = await frame.locator("html").evaluate(async () => {
      try { await fetch("https://unmocked.example.test/private"); return false; } catch { return globalThis.__appCanvas.requests.length === 1; }
    });
    assert.equal(rejected, true, "unknown external requests fail closed");
  console.log("PASS: fresh packaged install → source-inventory export / missing-state failure → 2 real routes / 6 states → save/navigation/add/retry/reset → missing-route failure → source refresh → unknown request denied.");
} finally {
  await browser?.close();
  await app?.close();
  await rm(root, { recursive: true });
}
