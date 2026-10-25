// The coding agent runs this once after inspecting the original source. This
// example is deliberately explicit: discovery cannot infer semantic outcomes.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { discoverUi } from '@tombelieber/agent-canvas/inventory';
import { populationFingerprint } from '@tombelieber/agent-canvas/population';
import example from './catalog.json' with { type: 'json' };

const inventoryPath = 'ui-review/ui-inventory.json';
const discovery = await discoverUi(process.cwd(), { exclude: [inventoryPath] });
const ids = example.catalog.map(row => row.id), taskIds = ids.filter(id => id.startsWith('tasks')), profileIds = ids.filter(id => id.startsWith('settings'));
const states = example.catalog.map(row => ({ id: row.id, kind: 'state', title: row.title, condition: row.title.split(' / ')[1], pageId: row.pageId, feature: row.feature, platform: 'web', layout: 'responsive', sources: ['src/App.jsx'], cases: [row.id], status: 'covered' }));
// Match reviewed original expressions and source locations, not case IDs
// synthesized from a source hash. New syntax sites must be inspected again.
const source = await readFile('src/App.jsx', 'utf8');
const rules = [
  ['if (error) return <section data-state="error"', ['tasks-error'], taskIds.filter(id => id !== 'tasks-error')],
  ['if (!tasks)', ['tasks-loading'], ['tasks', 'tasks-empty']],
  ['tasks.length ?', ['tasks'], ['tasks-empty']],
  ['!tasks.length &&', ['tasks-empty'], ['tasks']],
  ['if (error) return <section data-state="denied"', ['settings-denied'], profileIds.filter(id => id !== 'settings-denied')],
  ['if (!profile)', ['settings-loading'], ['settings', 'settings-saved']],
  ['saved &&', ['settings-saved'], ['settings']],
];
const bindings = discovery.anchors.map(anchor => {
  if (anchor.kind === 'render-condition') {
    const rule = rules.find(([expression]) => source.indexOf(expression) === anchor.offset);
    if (!rule) throw Error('New render condition needs inspection at ' + anchor.path + ':' + anchor.line);
    return { anchor: anchor.id, states: rule[anchor.outcome === 'true' ? 1 : 2] };
  }
  let related = ids;
  if (anchor.path === 'src/App.jsx') {
    const prefix = source.slice(0, anchor.offset);
    if (anchor.line === 14) related = ['tasks-error'];
    else if (anchor.line === 15) related = ['tasks-loading'];
    else if (prefix.lastIndexOf('function Tasks') > prefix.lastIndexOf('function Settings') && anchor.line < 36) related = ['tasks', 'tasks-empty'];
    else if (anchor.line === 29) related = ['settings-denied'];
    else if (anchor.line === 30) related = ['settings-loading'];
    else if (anchor.line < 36) related = ['settings', 'settings-saved'];
  }
  return { anchor: anchor.id, states: related };
});
// Entry/frame render roots also reach every original state. Non-rendering
// config, fixtures and styles are reviewed here rather than hidden by roots.
for (const row of states) row.sources.push('src/main.jsx', 'ui-review/frame.jsx', 'index.html');
const uiPaths = new Set(discovery.anchors.map(row => row.path));
const fileReviews = discovery.files.map(file => ({ path: file.path, role: uiPaths.has(file.path) ? 'ui' : file.path.endsWith('.css') ? 'asset' : 'support', summary: uiPaths.has(file.path) ? 'Inspected original renderer and both route families, including pending, failure, empty and saved conditions' : 'Inspected build, fixture, style or documentation dependency; distinct visible conditions are represented by original App states', ...(uiPaths.has(file.path) ? { states: ids } : {}) }));
const journeyFor = { 'tasks:settings': 'profile-flow', 'settings:tasks': 'return-flow', 'settings:settings-saved': 'profile-flow', 'tasks-error:tasks': 'retry-flow', 'tasks-empty:tasks': 'add-flow' };
const transitions = example.flows.map((edge, index) => ({ id: 'transition-' + index, from: edge.from, to: edge.to, kind: edge.kind || 'action', label: edge.label, ...(journeyFor[edge.from + ':' + edge.to] ? { journey: journeyFor[edge.from + ':' + edge.to] } : {}) }));
await writeFile(inventoryPath, JSON.stringify({ ...discovery, sourceRoot: '..', fileReviews, exclusionReviews: discovery.exclusions.map(row => ({ id: row.id, reason: 'Only generated capture/build receipts; original application and adapter sources remain scanned' })), states, bindings, transitions }, null, 2) + '\n');
await mkdir('.artifacts/app-canvas', { recursive: true });
await writeFile('.artifacts/app-canvas/inspected.json', JSON.stringify({ digest: populationFingerprint(discovery.files), states: states.length, transitions: transitions.length }));
console.log('Prepared 2 pages / 8 original UI states; source audit remains separate.');
