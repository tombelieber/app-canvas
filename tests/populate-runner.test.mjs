import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runPopulation, populationFingerprint } from '../lib/populate.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'canvas-runner-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const task = (id, options = {}) => ({ id, kind: 'prepare', fingerprint: populationFingerprint({ id }), resources: [], artifacts: [id + '.txt'], command: [process.execPath, '-e', `require('fs').appendFileSync('${id}.txt', 'x')`], ...options });
  return { root, task };
}

test('completed commands resume without rerunning; artifact drift invalidates dependencies', async t => {
  const { root, task } = await fixture(t), tasks = [task('build'), task('capture', { dependsOn: ['build'] })];
  const first = await runPopulation({ root, tasks }); assert.equal(first.status, 'ready-for-ui-verification');
  const second = await runPopulation({ root, tasks }); assert.ok(second.tasks.every(row => row.reused));
  assert.equal(await readFile(join(root, 'capture.txt'), 'utf8'), 'x');
  await writeFile(join(root, 'build.txt'), 'changed');
  const third = await runPopulation({ root, tasks }); assert.ok(third.tasks.every(row => !row.reused));
  assert.equal(await readFile(join(root, 'capture.txt'), 'utf8'), 'xx');
  tasks[0].fingerprint = populationFingerprint({ revision: 2 });
  assert.ok((await runPopulation({ root, tasks })).tasks.every(row => !row.reused));
});

test('unchanged failures are not retried; independent work completes and causes can be fixed', async t => {
  const { root, task } = await fixture(t);
  const fail = task('bad', { command: [process.execPath, '-e', "require('fs').appendFileSync('attempts.txt','x');process.exit(1)"] });
  const tasks = [fail, task('dependent', { dependsOn: ['bad'] }), task('good')];
  const first = await runPopulation({ root, tasks }); assert.deepEqual(first.tasks.map(row => row.status), ['failed', 'blocked', 'complete']);
  await runPopulation({ root, tasks }); assert.equal(await readFile(join(root, 'attempts.txt'), 'utf8'), 'x');
  tasks[0] = task('bad');
  assert.equal((await runPopulation({ root, tasks })).status, 'ready-for-ui-verification');
});

test('bounded parallelism never overlaps a shared device resource', async t => {
  const { root, task } = await fixture(t), resource = 'device-' + randomUUID();
  const command = id => [process.execPath, '-e', `const fs=require('fs');fs.writeFileSync('actor.lock','${id}',{flag:'wx'});setTimeout(()=>{fs.unlinkSync('actor.lock');fs.writeFileSync('${id}.txt','done')},50)`];
  const tasks = ['one', 'two', 'three'].map(id => task(id, { kind: 'capture', resources: [resource], command: command(id) }));
  const result = await runPopulation({ root, tasks, concurrency: 3 });
  assert.ok(result.tasks.every(row => row.status === 'complete'));
});

test('cross-run project ownership covers final UI verification as well as commands', async t => {
  const { root, task } = await fixture(t);
  let entered, finish;
  const inside = new Promise(done => entered = done), wait = new Promise(done => finish = done);
  const first = runPopulation({ root, tasks: [task('one')], finalize: async () => { entered(); await wait; return { states: 1 }; } });
  await inside;
  try { await assert.rejects(() => runPopulation({ root, tasks: [task('two')] }), error => error.code === 'ELOCKED'); }
  finally { finish(); }
  assert.equal((await first).status, 'ui-verified');
});

test('resource leases prevent different project actors competing for one device', async t => {
  const a = await fixture(t), b = await fixture(t), resource = 'device-' + randomUUID();
  let started;
  const ready = new Promise(done => started = done);
  const actor = "const fs=require('fs');const watcher=fs.watch('.',(_,name)=>{if(name==='release'&&fs.existsSync('release')){watcher.close();fs.writeFileSync('one.txt','done')}});fs.writeFileSync('started','')";
  const first = runPopulation({ root: a.root, tasks: [a.task('one', { kind: 'capture', resources: [resource], command: [process.execPath, '-e', actor] })], onEvent: event => { if (event.status === 'running') started(); } });
  await ready;
  // Running is emitted before lease acquisition. Wait on the actual actor's
  // filesystem event, rather than assuming an arbitrary sleep is sufficient.
  const { watch } = await import('node:fs');
  await new Promise(async (done, fail) => {
    const watcher = watch(a.root, (_, name) => { if (name === 'started') { watcher.close(); done(); } });
    try { await readFile(join(a.root, 'started')); watcher.close(); done(); } catch (error) { if (error.code !== 'ENOENT') { watcher.close(); fail(error); } }
  });
  try {
    const second = await runPopulation({ root: b.root, tasks: [b.task('two', { kind: 'capture', resources: [resource] })] });
    assert.equal(second.tasks[0].status, 'blocked'); assert.match(second.tasks[0].error, /another active owner/);
  } finally {
    await writeFile(join(a.root, 'release'), '');
    await first;
  }
});

test('interruption stops the actor and resumes; timeout is bounded and a failed UI gate never accepts', async t => {
  const { root, task } = await fixture(t), controller = new AbortController();
  const slow = task('slow', { command: [process.execPath, '-e', "setInterval(()=>{},1000)"], timeoutMs: 2000 });
  const first = runPopulation({ root, tasks: [slow], signal: controller.signal, onEvent: event => { if (event.status === 'running') setTimeout(() => controller.abort(), 60); } });
  assert.equal((await first).tasks[0].status, 'blocked');
  const timed = await runPopulation({ root, tasks: [{ ...slow, timeoutMs: 40 }] });
  assert.equal(timed.tasks[0].status, 'failed'); assert.match(timed.tasks[0].error, /timeout/);
  await assert.rejects(() => runPopulation({ root, tasks: [task('slow')], finalize() { throw Error('missing UI state'); } }), /missing UI state/);
  const checkpoint = JSON.parse(await readFile(join(root, '.artifacts/app-canvas/population.json')));
  assert.equal(checkpoint.status, 'incomplete');
});

test('invalid dependencies, missing artifacts and paths outside the project fail closed', async t => {
  const { root, task } = await fixture(t);
  await assert.rejects(() => runPopulation({ root, tasks: [task('one', { dependsOn: ['one'] })] }), /cycle/);
  await assert.rejects(() => runPopulation({ root, tasks: [task('one', { artifacts: ['../outside'] })] }), /leaves the project/);
  await symlink(tmpdir(), join(root, 'escape'));
  const escaped = await runPopulation({ root, tasks: [task('one', { artifacts: ['escape/outside'], command: [process.execPath, '-e', ''] })] });
  assert.equal(escaped.status, 'incomplete');
  const missing = await runPopulation({ root, tasks: [task('one', { command: [process.execPath, '-e', ''] })] });
  assert.equal(missing.tasks[0].status, 'failed');
});

test('cancelled actor descendants are killed before their device lease is released', { skip: process.platform === 'win32', timeout: 5000 }, async t => {
  const { root, task } = await fixture(t), controller = new AbortController();
  const { watch } = await import('node:fs');
  const grandchild = "process.on('SIGTERM',()=>{});require('fs').writeFileSync('actor-ready','');setTimeout(()=>require('fs').writeFileSync('orphan.txt','still acting'),200);setInterval(()=>{},1000)";
  const command = [process.execPath, '-e', `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:'inherit'});setInterval(()=>{},1000)`];
  const watcher = watch(root, (_, name) => { if (name === 'actor-ready') controller.abort(); });
  try {
    const result = await runPopulation({ root, tasks: [task('actor', { kind: 'capture', resources: ['actor-' + randomUUID()], command })], signal: controller.signal });
    assert.equal(result.tasks[0].status, 'blocked');
    await new Promise(done => setTimeout(done, 300));
    await assert.rejects(() => readFile(join(root, 'orphan.txt')), error => error.code === 'ENOENT');
  } finally { watcher.close(); }
});
