import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { discoverUi, uiWorkStatus } from './ui-discovery.mjs';
import { runPopulation } from './populate.mjs';

export async function uiWorklistCommand(command, values) {
  if (command === 'guide') {
    console.log(await readFile(new URL('../skills/agent-canvas/SKILL.md', import.meta.url), 'utf8'));
    return;
  }
  if (command === 'plan' && !values.out) throw Error('plan requires --out <new-ui-inventory.json>');
  if (command === 'status' && !values.inventory) throw Error('status requires --inventory <ui-inventory.json>');
  const path = resolve(command === 'plan' ? values.out : values.inventory);
  const old = command === 'status' ? JSON.parse(await readFile(path, 'utf8')) : undefined;
  if (old && old.version !== 1) throw Error('status needs a version 1 UI discovery worklist');
  const sourceRoot = command === 'plan' ? resolve(values['source-root'] || '.') : resolve(dirname(path), old.sourceRoot || '.');
  const discovery = await discoverUi(sourceRoot, { exclude: [relative(sourceRoot, path)] });
  if (command === 'plan') {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify({ ...discovery, sourceRoot: relative(dirname(path), sourceRoot) || '.', fileReviews: [], exclusionReviews: [], states: [], bindings: [], transitions: [] }, null, 2) + '\n', { flag: 'wx' });
    console.log(`UI worklist: ${discovery.files.length} files to inspect, ${discovery.anchors.length} UI anchors to resolve. ${path}`);
  } else {
    const unchanged = new Set(discovery.files.filter(file => old.files.some(previous => previous.path === file.path && previous.sha256 === file.sha256)).map(file => file.path));
    console.log(JSON.stringify({ ...uiWorkStatus({ ...old, ...discovery, fileReviews: (old.fileReviews || []).filter(row => unchanged.has(row.path)) }),
    sourceChanged: JSON.stringify(old.files) !== JSON.stringify(discovery.files), issues: discovery.issues,
    note: 'Discovery anchors are inspection work, not a screen count. Runtime acceptance: --ui-complete. Strict source audit: --complete.' }, null, 2));
  }
}

export async function populateProject(project, root, { signal, finalize } = {}) {
  const options = typeof project.population === 'function' ? await project.population({ root }) : project.population;
  if (!options || !project.uiCoverage) throw Error('populate needs agent-authored population tasks and an independent uiCoverage inventory; follow agent-canvas guide');
  const state = await runPopulation({ ...options, root, signal, finalize, onEvent(event) {
    console.log(`${event.status}: ${event.id}${event.log ? ' (' + event.log + ')' : ''}`);
  } });
  if (state.status !== 'ui-verified') throw Error(`Population incomplete: ${state.tasks.filter(row => row.status !== 'complete').map(row => row.id + ': ' + (row.error || row.status)).join('; ')}. Resume the same populate command after fixing the cause.`);
  return { state, checkpoint: options.checkpoint || '.artifacts/app-canvas/population.json' };
}
