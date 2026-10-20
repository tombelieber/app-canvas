import "./fixtures/import-storage.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../bin/app-canvas.mjs", import.meta.url));

test("the public discovery command leaves a pending worklist and refuses to overwrite it", async t => {
  const root = await mkdtemp(join(tmpdir(), "app-canvas-discover-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "Login.java"), "class Login { void render() { if (denied) show(); } }");
  await exec(process.execPath, [cli, "discover", "--out", ".artifacts/inventory.json"], { cwd: root });
  const snapshot = JSON.parse(await readFile(join(root, ".artifacts/inventory.json"), "utf8"));
  assert.equal(snapshot.version, 2);
  assert.equal(snapshot.files.length, 1);
  assert.ok(snapshot.obligations.some(item => item.kind === "branch"));
  assert.deepEqual(snapshot.reviews, []);
  assert.deepEqual(snapshot.items, []);
  const pending = await exec(process.execPath, [cli, "pending", "--inventory", ".artifacts/inventory.json"], { cwd: root });
  assert.ok(JSON.parse(pending.stdout).pending > 0);
  await assert.rejects(() => exec(process.execPath, [cli, "discover", "--out", ".artifacts/inventory.json"], { cwd: root }), error => error.code === 1);
  assert.deepEqual(JSON.parse(await readFile(join(root, ".artifacts/inventory.json"), "utf8")), snapshot);
});

test("complete validation cannot be replaced with catalog checks or disabled config flags", async t => {
  const root = await mkdtemp(join(tmpdir(), "app-canvas-complete-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, ".artifacts"));
  await writeFile(join(root, "canvas.config.mjs"), 'export default {title:"Partial",groups:[{id:"app"}],catalog:[{id:"home",title:"Home",group:"app"}],coverage:{requireSourceInventory:false,requireAllCases:false,requireConnected:false}}');
  await assert.rejects(() => exec(process.execPath, [cli, "--complete"], { cwd: root }), error => error.code === 1 && /source inventory|checked playable case/i.test(error.stderr));
  await assert.rejects(() => exec(process.execPath, [cli, "--complete", "--check"], { cwd: root }), error => error.code === 1 && /cannot combine/i.test(error.stderr));
});

test("browser setup resolves Playwright's declared executable before spawning installation", async () => {
  // Keep downloads outside the unit gate, but use real dependency metadata and
  // the actual public app-canvas entry point. Intercept only the process IO.
  const preload = `
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    import { existsSync } from 'node:fs';
    import assert from 'node:assert/strict';
    childProcess.spawnSync = (executable, args) => {
      assert.equal(executable, process.execPath);
      assert.ok(existsSync(args[0]));
      assert.match(args[0], /playwright.*cli\\.js$/);
      assert.deepEqual(args.slice(1), ['install', 'chromium']);
      console.log('public browser setup entry reached');
      return { status: 0 };
    };
    syncBuiltinESMExports();
  `;
  const cli = fileURLToPath(new URL("../bin/app-canvas.mjs", import.meta.url));
  const result = await promisify(execFile)(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, cli, "browsers"]);
  assert.match(result.stdout, /public browser setup entry reached/);
});

test('UI planning is independent, status detects stale reviews, and guide matches its package', async t => {
  const root = await mkdtemp(join(tmpdir(), 'app-canvas-plan-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'App.jsx'), 'export const App = () => <main>Original UI</main>');
  const args = [cli, 'plan', '--out', '.artifacts/ui-inventory.json'];
  await exec(process.execPath, args, { cwd: root });
  const path = join(root, '.artifacts/ui-inventory.json'), work = JSON.parse(await readFile(path));
  assert.equal(work.states.length, 0); assert.ok(work.anchors.length > 0);
  work.fileReviews = [{ path: 'App.jsx', role: 'ui', summary: 'Inspected original root', states: ['home'] }];
  await writeFile(path, JSON.stringify(work));
  await assert.rejects(() => exec(process.execPath, args, { cwd: root }), error => error.code === 1);
  await writeFile(join(root, 'App.jsx'), 'export const App = () => <main>Changed UI</main>');
  const status = JSON.parse((await exec(process.execPath, [cli, 'status', '--inventory', path], { cwd: root })).stdout);
  assert.equal(status.sourceChanged, true); assert.equal(status.sourceFilesToInspect, 1);
  assert.ok(status.uiAnchorsToResolve > 0);
  const guide = await exec(process.execPath, [cli, 'guide']);
  assert.equal(guide.stdout.trim(), (await readFile(new URL('../skills/app-canvas/SKILL.md', import.meta.url), 'utf8')).trim());
  await assert.rejects(() => exec(process.execPath, [cli, 'populate', '--check'], { cwd: root }), error => /cannot replace/.test(error.stderr));
});


test('desktop project status and source UI worklist status keep separate CLI paths', async t => {
  const root = await mkdtemp(join(tmpdir(), 'app-canvas-dual-status-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = join(root, 'desktop');
  await exec(process.execPath, [cli, 'import', 'https://example.test/overview', '--agent', '--out', project, '--allow-ephemeral']);
  const status = JSON.parse((await exec(process.execPath, [cli, 'status', project])).stdout);
  assert.equal(status.coverage, 'observed'); assert.equal(status.states, 0);
  await assert.rejects(() => exec(process.execPath, [cli, 'status', project, '--inventory', 'ambiguous.json']), error => /Unsupported --inventory/.test(error.stderr));
  await assert.rejects(() => exec(process.execPath, [cli, 'capture', project, '--ui-complete']), error => /observed coverage/.test(error.stderr));
});
