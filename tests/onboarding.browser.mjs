process.env.APP_CANVAS_TELEMETRY = "0";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
  const inventory = { version: 1, files, items: config.catalog.map(row => row.id).map(id => ({ id, kind: "state", sources: files.map(f => f.path), cases: [id] })) };
  await writeFile(join(project, "ui-review/inventory.json"), JSON.stringify(inventory));
  await writeFile(join(project, "ui-review/strict.config.mjs"), `import base from './canvas.config.mjs'; export default { ...base, coverage: { requireSourceInventory: true }, sourceCoverage: { roots: ['src'], inventory: 'ui-review/inventory.json' } };`);
  const cli = join(installed, "bin/app-canvas.mjs");
  const home = join(root, "agent-home");
  await exec(process.execPath, [cli, "install"], { env: { ...process.env, HOME: home } });
  for (const harness of ["codex", "claude"])
    for (const file of ["SKILL.md", "agents/openai.yaml", "references/completion.md", "references/native.md", "references/source-audit.md", "references/population.md"])
      assert.deepEqual(
        await readFile(join(home, `.${harness}/skills/app-canvas`, file)),
        await readFile(join(installed, "skills/app-canvas", file)),
        `the public installer must ship the canonical ${file} to ${harness}`,
      );
  await exec(process.execPath, [fileURLToPath(new URL("./population.browser.mjs", import.meta.url))], { env: { ...process.env, APP_CANVAS_TEST_CLI: cli }, maxBuffer: 1024 * 1024 });
  const strictArgs = [cli, "--config", "ui-review/strict.config.mjs", "--check"];
  assert.match((await exec(process.execPath, strictArgs, { cwd: project })).stdout, /8 source inventory items mapped/);
  inventory.items.pop();
  await writeFile(join(project, "ui-review/inventory.json"), JSON.stringify(inventory));
  await assert.rejects(() => exec(process.execPath, strictArgs, { cwd: project }), error => error.code === 1 && /settings-saved/.test(error.stderr));
  inventory.items.push({ id: "settings-saved", kind: "state", sources: files.map(f => f.path), cases: ["settings-saved"] });
  await writeFile(join(project, "ui-review/inventory.json"), JSON.stringify(inventory));
  await assert.rejects(() => checkRouteCoverage({ ...config, catalog: config.catalog.filter((s) => s.path !== "/settings") }, project), /Pages missing/);
  const deliveryArgs = [cli, "populate", "--config", "ui-review/delivery.config.mjs", "--verify"];
  const delivery = await exec(process.execPath, deliveryArgs, { cwd: project, maxBuffer: 1024 * 1024 });
  assert.match(delivery.stdout, /UI delivery verified.*2 pages, 8 states, 8 canvas cases, 8 links/);
  const checkpointPath = join(project, '.artifacts/app-canvas/population.json');
  const accepted = JSON.parse(await readFile(checkpointPath));
  assert.equal(accepted.status, 'ui-verified');
  const repeated = await exec(process.execPath, deliveryArgs, { cwd: project, maxBuffer: 1024 * 1024 });
  assert.doesNotMatch(repeated.stdout, /running: inspect-example/, 'resume reuses inspected artifacts but performs fresh final UI verification');
  assert.equal(JSON.parse(await readFile(checkpointPath)).tasks[0].reused, true);
  const uiOnlyArgs = [cli, '--config', 'ui-review/delivery.config.mjs', '--ui-complete'];
  await assert.rejects(() => exec(process.execPath, [...uiOnlyArgs, '--source-root', installed], { cwd: project }), error => /root does not match/.test(error.stderr));
  const uiInventoryPath = join(project, 'ui-review/ui-inventory.json');
  const uiInventory = JSON.parse(await readFile(uiInventoryPath));
  uiInventory.bindings.pop();
  await writeFile(uiInventoryPath, JSON.stringify(uiInventory));
  await assert.rejects(() => exec(process.execPath, uiOnlyArgs, { cwd: project }), error => /Unresolved UI surface/.test(error.stderr));
  await assert.rejects(() => exec(process.execPath, [cli, '--config', 'ui-review/delivery.config.mjs', '--complete'], { cwd: project }), error => /Source inventory is required/.test(error.stderr));
  const source = join(project, "src/App.jsx"), before = await readFile(source, "utf8");
  await writeFile(source, before.replace("</Routes>", '<Route path="/new" element={<Tasks />} /></Routes>'));
  await assert.rejects(() => loadProject(configPath, project), /Route inventory changed/);
  await writeFile(source, before);
  app = await startCanvas({ root: project, configPath, port: 0, watchFiles: true });
  const proof = await app.verify();
  assert.equal(proof.total, 8);
  assert.equal(proof.interactionsVerified, true);
  // Keep the canvas open: source edits must refresh its mounted real UI.
  const { chromium } = await import(pathToFileURL(join(installed, "node_modules/playwright/index.mjs"))).catch(() => import("playwright"));
  browser = await chromium.launch({ headless: true });
  if (process.env.APP_CANVAS_BENCHMARK_DIR) {
    const { measureCapturePlanning } = await import('./population-performance.browser.mjs');
    const { planCaptures } = await import(pathToFileURL(join(installed, 'lib/populate.mjs')));
    const preview = { url: item => new URL('/preview/' + item.id, app.address).href };
    // The real adapter's preview URLs are supplied by the manifest.
    const manifest = await (await fetch(new URL('/manifest.json', app.address))).json();
    preview.url = item => new URL(manifest.screens[item.id].url, app.address).href;
    const report = await measureCapturePlanning({ browser, preview, catalog: config.catalog, planCaptures, directory: process.env.APP_CANVAS_BENCHMARK_DIR, sourceDigest: accepted.delivery.digest });
    console.log('Capture planning benchmark: ' + JSON.stringify(report));
  }

  const page = await browser.newPage();
  await page.goto(app.address);
  await page.getByRole("button", {name:"▶ Use app",exact:true}).click();
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
  console.log("PASS: fresh packaged install → canonical Codex/Claude skills and references → source-inventory export / missing-state failure → 2 real routes / 8 states → save/navigation/add/retry/reset → missing-route failure → source refresh → unknown request denied.");
} finally {
  await browser?.close();
  await app?.close();
  await rm(root, { recursive: true });
}
