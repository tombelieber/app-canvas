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
  assert.equal(guide.stdout.trim(), (await readFile(new URL('../skills/agent-canvas/SKILL.md', import.meta.url), 'utf8')).trim());
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

test('piped CLI help includes the complete review-export contract', async () => {
  const { stdout } = await exec(process.execPath, [cli, '--help']);
  assert.match(stdout, /export \[--config <config>\] \[--review-only\]/);
  assert.match(stdout, /export --project <captured-project-directory> --review-only/);
  assert.ok(stdout.endsWith('agent-canvas telemetry on|off|status|dogfood|unknown'));
});


test('canonical and legacy CLI aliases expose the same version, guide and complete help', async () => {
  const canonical = fileURLToPath(new URL('../bin/agent-canvas.mjs', import.meta.url));
  for (const args of [['--version'], ['--help'], ['guide']]) {
    const [current, legacy] = await Promise.all([
      exec(process.execPath, [canonical, ...args]),
      exec(process.execPath, [cli, ...args]),
    ]);
    assert.equal(current.stdout, legacy.stdout);
    if (args[0] === '--help') assert.match(current.stdout, /^agent-canvas --config/);
    if (args[0] === 'guide') assert.match(current.stdout, /name: agent-canvas/);
  }
});

test('interactive imported viewer receives safe telemetry while noninteractive agent import stays untracked', { timeout: 30000 }, async t => {
  const { createServer } = await import('node:http');
  const { spawn } = await import('node:child_process');
  const { once } = await import('node:events');
  const { stat } = await import('node:fs/promises');
  const { createAgentProject } = await import('../lib/import/agent.mjs');
  const root = await mkdtemp(join(tmpdir(), 'agent-canvas-cli-import-telemetry-'));
  const home = join(root, 'home'), directory = join(root, 'private-project');
  const received = [];
  const collector = createServer(async (request, response) => {
    let data = ''; for await (const chunk of request) data += chunk;
    received.push(JSON.parse(data)); response.end('{"ok":true}');
  });
  collector.listen(0, '127.0.0.1'); await once(collector, 'listening');
  const endpoint = `http://127.0.0.1:${collector.address().port}/capture`;
  const env = { ...process.env, HOME: home, CI: '', DO_NOT_TRACK: '', APP_CANVAS_TELEMETRY: '1', APP_CANVAS_TELEMETRY_ENDPOINT: endpoint, APP_CANVAS_ENVIRONMENT: 'test', APP_CANVAS_COHORT_CLASS: 'internal_test', APP_CANVAS_INSTALL_SOURCE: '' };
  await createAgentProject({ directory, allowEphemeral: true, url: 'https://private.example.test/dashboard' });
  const child = spawn(process.execPath, [cli, 'open', directory, '--port', '0'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; }
    await new Promise(resolve => collector.close(resolve));
    await rm(root, { recursive: true, force: true });
  });
  let stderr = ''; child.stderr.on('data', bytes => { stderr += bytes; });
  const address = await new Promise((resolve, reject) => {
    let stdout = '';
    child.stdout.on('data', bytes => { stdout += bytes; const found = stdout.match(/import: (http:\/\/127\.0\.0\.1:\d+)/); if (found) resolve(found[1]); });
    child.once('error', reject); child.once('exit', code => reject(Error(`Viewer exited ${code}: ${stderr}`)));
  });
  const config = await (await fetch(address + '/telemetry.json')).json();
  assert.equal(config.enabled, true); assert.equal(config.local, true);
  assert.equal(config.surface, 'real_project'); assert.equal(config.cohort_class, 'internal_test');
  assert.equal(config.source, 'unknown', 'the CLI cannot infer its installation channel');
  const response = await fetch(address + '/telemetry', { method: 'POST', headers: { Origin: address, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: config.id, event: 'viewer_ready', properties: { surface: config.surface, version: config.version, source: config.source } }) });
  assert.equal(response.status, 204); assert.equal(received.length, 1);
  assert.equal(received[0].event, 'viewer_ready'); assert.equal(received[0].properties.environment, 'test');
  assert.equal(received[0].properties.source, 'unknown');
  assert.doesNotMatch(JSON.stringify(received), /private-project|private\.example|dashboard/);
  const agentHome = join(root, 'agent-home');
  const noninteractive = await exec(process.execPath, [cli, 'import', 'https://private.example.test/dashboard', '--agent', '--out', join(root, 'agent-project'), '--allow-ephemeral'], { env: { ...env, HOME: agentHome } });
  assert.doesNotMatch(noninteractive.stderr, /anonymous usage/i);
  await assert.rejects(() => stat(join(agentHome, '.config/app-canvas/telemetry.json')), { code: 'ENOENT' });
  assert.equal(received.length, 1, 'agent import emits no telemetry');
});
