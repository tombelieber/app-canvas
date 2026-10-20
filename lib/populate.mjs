import { mkdir, readFile, writeFile, rename, realpath, open } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import lockfile from 'proper-lockfile';
import { populationFingerprint } from './population-plan.mjs';
export { populationFingerprint, planCaptures } from './population-plan.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const identifier = value => typeof value === 'string' && /^[\w:./-]+$/.test(value);
function local(root, path) {
  if (typeof path !== 'string' || !path || isAbsolute(path)) throw Error('Population artifacts and working directories must be project-relative');
  const result = resolve(root, path), rel = relative(root, result);
  if (rel === '..' || rel.startsWith('..' + sep)) throw Error('Population path leaves the project');
  return result;
}
async function artifacts(root, paths) {
  const output = [];
  for (const path of paths) {
    const absolute = await realpath(local(root, path)), rel = relative(root, absolute);
    if (rel === '..' || rel.startsWith('..' + sep)) throw Error('Population artifact symlink leaves the project');
    output.push({ path, sha256: hash(await readFile(absolute)) });
  }
  return output;
}
async function atomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = path + '.' + randomUUID() + '.tmp';
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await rename(temporary, path);
}
async function execute(task, root, signal, log) {
  await mkdir(dirname(log), { recursive: true });
  const output = await open(log, 'w', 0o600);
  try {
    await new Promise((done, fail) => {
      let failure, escalation;
      const child = spawn(task.command[0], task.command.slice(1), { cwd: local(root, task.cwd || '.'), shell: false,
        env: { ...process.env, APP_CANVAS_TELEMETRY: '0' }, stdio: ['ignore', output.fd, output.fd], detached: process.platform !== 'win32' });
      function kill(kind) {
        if (!child.pid) return;
        try { if (process.platform === 'win32') child.kill(kind); else process.kill(-child.pid, kind); }
        catch (error) { if (error.code !== 'ESRCH') failure ||= error; }
      }
      function stop(reason) { failure ||= Error(reason); kill('SIGTERM'); escalation ||= setTimeout(() => kill('SIGKILL'), 250); }
      const abort = () => stop('Run interrupted; resume from checkpoint');
      const timeout = setTimeout(() => stop('Task timeout'), task.timeoutMs || 300000);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      child.once('error', error => { failure ||= error; });
      child.once('close', (code, killed) => {
        // A parent may exit on TERM while an actor descendant ignores it.
        // Finish the cancelled process group before releasing its device lease.
        if (escalation) kill('SIGKILL');
        clearTimeout(timeout); clearTimeout(escalation); signal.removeEventListener('abort', abort);
        failure ? fail(failure) : code === 0 ? done() : fail(Error('Task exited ' + (code ?? killed)));
      });
    });
  } finally { await output.close(); }
}

// Durable adapter execution. The agent authors original-runtime commands, not
// a duplicate renderer. A project owner lock and shared resource leases prevent
// competing actors. Healthy leases are never removed by a retry.
export async function runPopulation({ root, tasks, checkpoint = '.artifacts/app-canvas/population.json', concurrency = 2, signal, onEvent = () => {}, retryFailed = false, finalize }) {
  root = await realpath(root);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8 || !Array.isArray(tasks) || !tasks.length) throw Error('Population requires tasks and bounded concurrency (1-8)');
  const ids = new Set(), fingerprints = new Map();
  for (const task of tasks) {
    if (!identifier(task.id) || ids.has(task.id) || !['prepare', 'build', 'capture'].includes(task.kind) || !/^[a-f0-9]{64}$/.test(task.fingerprint || '') || !Array.isArray(task.command) || !task.command.length || task.command.some(value => typeof value !== 'string') || !Array.isArray(task.artifacts) || !task.artifacts.length || !Array.isArray(task.resources) || task.resources.some(value => !identifier(value))) throw Error('Population task needs unique ID, kind, fingerprint, command array, resources and artifact paths');
    if (task.kind === 'capture' && !task.resources.length) throw Error('Capture tasks must declare their device/browser resources');
    if (task.timeoutMs !== undefined && (!Number.isInteger(task.timeoutMs) || task.timeoutMs < 1)) throw Error('Task timeout must be positive milliseconds');
    local(root, task.cwd || '.'); task.artifacts.forEach(path => local(root, path));
    ids.add(task.id);
  }
  const visiting = new Set();
  function fingerprint(id) {
    if (fingerprints.has(id)) return fingerprints.get(id);
    if (visiting.has(id)) throw Error('Population task dependency cycle');
    const task = tasks.find(row => row.id === id); if (!task) throw Error('Unknown population task dependency: ' + id);
    visiting.add(id);
    const dependencies = (task.dependsOn || []).map(id => [id, fingerprint(id)]);
    const value = populationFingerprint({ input: task.fingerprint, command: task.command, cwd: task.cwd || '.', kind: task.kind, timeoutMs: task.timeoutMs || 300000, resources: [...task.resources].sort(), artifacts: task.artifacts, dependencies });
    fingerprints.set(id, value); visiting.delete(id); return value;
  }
  tasks.forEach(task => fingerprint(task.id));
  const path = local(root, checkpoint), lockPath = resolve(root, '.artifacts/app-canvas/owner.lock');
  await mkdir(dirname(lockPath), { recursive: true });
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason); signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const options = { stale: 30000, update: 10000, retries: 0, onCompromised: error => controller.abort(error) };
  let release;
  try { release = await lockfile.lock(root, { ...options, lockfilePath: lockPath }); }
  catch (error) { signal?.removeEventListener('abort', abort); throw error; }
  const shared = join(tmpdir(), 'app-canvas-population-resources');
  let state;
  try {
    let old;
    try { old = JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (old && (old.version !== 1 || old.root !== root)) throw Error('Population checkpoint belongs to another project or schema');
    const records = new Map();
    for (const task of tasks) {
      const previous = old?.tasks.find(row => row.id === task.id), key = fingerprints.get(task.id);
      let cached = previous?.status === 'complete' && previous.fingerprint === key;
      if (cached) try { cached = JSON.stringify(await artifacts(root, task.artifacts)) === JSON.stringify(previous.artifacts); } catch { cached = false; }
      records.set(task.id, cached ? { ...previous, reused: true } : { id: task.id, kind: task.kind, fingerprint: key,
        status: previous?.status === 'failed' && previous.fingerprint === key && !retryFailed ? 'failed' : 'pending', reused: false });
    }
    // Artifact drift invalidates downstream jobs even with unchanged commands.
    let changed;
    do { changed = false; for (const task of tasks) if (records.get(task.id).reused && (task.dependsOn || []).some(id => !records.get(id).reused)) {
      Object.assign(records.get(task.id), { status: 'pending', reused: false }); changed = true;
    } } while (changed);
    state = { version: 1, root, status: 'running', startedAt: new Date().toISOString(), tasks: [...records.values()] };
    const save = () => atomic(path, state);
    let writes = Promise.resolve();
    const persist = () => { writes = writes.then(save); return writes; };
    await persist(); await mkdir(shared, { recursive: true });
    const active = new Map(), busy = new Set();
    async function run(task) {
      const record = records.get(task.id), releases = [];
      try {
        record.status = 'running'; await persist(); onEvent({ id: task.id, status: 'running' });
        for (const resource of [...new Set(task.resources)].sort()) {
          const target = join(shared, hash(resource)); await writeFile(target, '', { flag: 'a' });
          releases.push(await lockfile.lock(target, options));
        }
        const log = relative(root, resolve(dirname(path), 'logs', hash(task.id) + '.log'));
        record.log = log;
        await execute(task, root, controller.signal, local(root, log));
        record.artifacts = await artifacts(root, task.artifacts); record.status = 'complete';
      } catch (error) { record.status = controller.signal.aborted || error.code === 'ELOCKED' ? 'blocked' : 'failed'; record.error = error.code === 'ELOCKED' ? 'Required resource has another active owner' : error.message; }
      finally {
        for (const unlock of releases.reverse()) await unlock().catch(error => { record.status = 'failed'; record.error = error.message; });
        task.resources.forEach(value => busy.delete(value));
        await persist(); onEvent({ id: task.id, status: record.status, log: record.log });
      }
    }
    try { for (;;) {
      let started = false;
      if (!controller.signal.aborted) for (const task of tasks) {
        if (active.size >= concurrency) break;
        if (records.get(task.id).status !== 'pending' || task.resources.some(value => busy.has(value)) || (task.dependsOn || []).some(id => records.get(id).status !== 'complete')) continue;
        task.resources.forEach(value => busy.add(value));
        const job = run(task).finally(() => active.delete(task.id)); active.set(task.id, job); started = true;
      }
      if (active.size) await Promise.race(active.values());
      else if (!started) break;
    } } finally {
      if (active.size) { controller.abort(Error('Population execution interrupted')); await Promise.allSettled(active.values()); }
    }
    for (const record of records.values()) if (record.status === 'pending') { record.status = 'blocked'; record.error = controller.signal.aborted ? 'Run interrupted; resume from checkpoint' : 'Dependency not complete'; }
    state.status = !controller.signal.aborted && state.tasks.every(row => row.status === 'complete') ? 'ready-for-ui-verification' : 'incomplete';
    state.completedAt = new Date().toISOString(); await persist();
    if (state.status === 'ready-for-ui-verification' && finalize) {
      try {
        state.delivery = await finalize(); controller.signal.throwIfAborted(); state.status = 'ui-verified'; state.verifiedAt = new Date().toISOString();
      } catch (error) { state.status = 'incomplete'; state.error = error.message; await persist(); throw error; }
      await persist();
    }
    return state;
  } finally { signal?.removeEventListener('abort', abort); await release(); }
}
