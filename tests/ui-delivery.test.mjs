import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverUi, uiWorkStatus } from '../lib/ui-discovery.mjs';
import { checkUiCoverage } from '../lib/ui-coverage.mjs';
import { checkSourceCoverage, discoverSources } from '../lib/inventory.mjs';
import { validatePopulationProof } from '../lib/population-proof.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'canvas-ui-delivery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'App.jsx'), 'export function App({failed}) {\n if (failed) return <p>Error</p>;\n return <main>Ready</main>;\n}\nfunction telemetry(x) { if(x) return 1; return 0; }');
  const discovery = await discoverUi(root);
  const states = ['error', 'ready'].map(id => ({ id, title: id, kind: 'state', condition: id, pageId: 'home', feature: 'Main', platform: 'web', layout: 'phone', sources: ['App.jsx'], cases: [id], status: 'covered' }));
  const inventory = { ...discovery, sourceRoot: '.', fileReviews: [{ path: 'App.jsx', role: 'ui', summary: 'Reviewed both visible outcomes and non-rendering telemetry', states: ['error', 'ready'] }], states,
    bindings: discovery.anchors.map(row => ({ anchor: row.id, states: [row.kind === 'render-condition' ? row.outcome === 'true' ? 'error' : 'ready' : row.line === 2 ? 'error' : 'ready'] })), transitions: [] };
  const project = { catalog: states.map(row => ({ id: row.id, pageId: row.pageId, feature: row.feature })), uiCoverage: { inventory: 'inventory.json' } };
  const save = () => writeFile(join(root, 'inventory.json'), JSON.stringify(inventory));
  await save(); return { root, inventory, project, save };
}

test('UI state proof is semantic; internal source audit remains separate and strict', async t => {
  const f = await fixture(t), report = await checkUiCoverage(f.project, f.root);
  assert.equal(report.states, 2); assert.equal(report.screens, 1);
  assert.equal(f.inventory.anchors.filter(row => row.kind === 'render-condition').length, 2, 'telemetry predicates do not invent UI states');
  const proof = { sourceDigest: report.digest, cases: ['error', 'ready'].map(id => ({ id, runtime: 'web', fixtureId: id, buildId: 'build', assertions: [{ id: id + '-visible', passed: true, sources: [id] }] })) };
  await validatePopulationProof({ root: f.root, project: { ...f.project, sourceCoverageReport: report }, proof });
  proof.cases.pop();
  await assert.rejects(() => validatePopulationProof({ root: f.root, project: { ...f.project, sourceCoverageReport: report }, proof }), /Missing runtime evidence/);
  const raw = await discoverSources(f.root, { exclude: ['audit.json'] });
  await writeFile(join(f.root, 'audit.json'), JSON.stringify({ ...raw, sourceRoot: '.', reviews: [], items: [] }));
  await assert.rejects(() => checkSourceCoverage({ ...f.project, sourceCoverage: { inventory: 'audit.json' } }, f.root, { complete: true }), /unreviewed|not inventoried/i);
});

test('omitting a screen from both catalog and inventory still fails independent discovery', async t => {
  const f = await fixture(t);
  f.inventory.states.shift(); f.project.catalog.shift();
  f.inventory.fileReviews[0].states = ['ready'];
  f.inventory.bindings = f.inventory.bindings.filter(row => !row.states.includes('error'));
  await f.save();
  await assert.rejects(() => checkUiCoverage(f.project, f.root), /Unresolved UI surface/);
  assert.equal(uiWorkStatus(f.inventory).uiAnchorsToResolve, 2);
});

test('a UI file cannot be hidden as support or opposite outcomes collapsed into one case', async t => {
  const f = await fixture(t);
  f.inventory.fileReviews[0].role = 'support'; await f.save();
  await assert.rejects(() => checkUiCoverage(f.project, f.root), /cannot be hidden/);
  f.inventory.fileReviews[0].role = 'ui';
  f.inventory.bindings.forEach(row => row.states = ['ready']); await f.save();
  await assert.rejects(() => checkUiCoverage(f.project, f.root), /Opposite UI conditions/);
});

test('source drift, a new route and unresolved syntax invalidate UI acceptance', async t => {
  const f = await fixture(t);
  const path = join(f.root, 'App.jsx'), before = await readFile(path, 'utf8');
  await writeFile(path, before + '\nexport const NewRoute = () => <p>New</p>');
  await assert.rejects(() => checkUiCoverage(f.project, f.root), /UI source changed/);
  await writeFile(path, 'export const Broken = () => <div>');
  assert.ok((await discoverUi(f.root, { exclude: ['inventory.json'] })).issues.length);
});

test('drawn web actions require a real checked continuing journey and transition evidence', async t => {
  const f = await fixture(t);
  f.inventory.transitions = [{ id: 'retry', from: 'error', to: 'ready', kind: 'recovery', label: 'Retry', journey: 'retry-flow' }];
  f.project.flows = [{ from: 'error', to: 'ready', kind: 'recovery' }]; await f.save();
  await assert.rejects(() => checkUiCoverage(f.project, f.root), /checked continuing journey/);
  f.project.journeys = [{ id: 'retry-flow', kind: 'flow', entry: 'error', steps: [{ screen: 'ready', actions: [{ type: 'click', selector: 'button' }, { type: 'expect', selector: 'main' }] }] }];
  const report = await checkUiCoverage(f.project, f.root);
  assert.deepEqual(report.requiredEvidence.ready.map(row => row.id), ['ready', 'retry']);
});

test('later attached native accessories cannot disappear from the UI inspection queue', async t => {
  const root = await mkdtemp(join(tmpdir(), 'canvas-native-ui-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'Form.m'), '@interface Form : UIViewController\n@end\n@implementation Form\n- (void)enter { toolbar = [UIToolbar new]; done = [UIBarButtonItem new]; }\n- (void)retry { field.inputAccessoryView = toolbar; }\n@end');
  const d = await discoverUi(root);
  assert.equal(d.anchors.filter(row => row.kind === 'native-accessory').length, 3);
  const states = [{ id: 'form', kind: 'screen', title: 'Form', condition: 'First entry', pageId: 'form', feature: 'Input', platform: 'ios', layout: 'phone', sources: ['Form.m'], cases: ['form'], status: 'covered' }];
  await writeFile(join(root, 'inventory.json'), JSON.stringify({ ...d, sourceRoot: '.', states, fileReviews: [{ path: 'Form.m', role: 'ui', summary: 'First entry only', states: ['form'] }], bindings: d.anchors.filter(row => row.kind !== 'native-accessory').map(row => ({ anchor: row.id, states: ['form'] })) }));
  await assert.rejects(() => checkUiCoverage({ catalog: [{ id: 'form', pageId: 'form', feature: 'Input' }], uiCoverage: { inventory: 'inventory.json' } }, root), /Unresolved UI surface/);
});

test('literal dead JSX does not fabricate a second user-visible screen', async t => {
  const root = await mkdtemp(join(tmpdir(), 'canvas-static-ui-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'App.jsx'), 'export function App() {\n if (false) return <p>Dead debug</p>;\n return <main>Actual UI</main>;\n}');
  const discovery = await discoverUi(root);
  assert.deepEqual(discovery.anchors.filter(row => row.kind === 'render-condition').map(row => row.outcome), ['false']);
  assert.deepEqual(discovery.anchors.filter(row => row.kind === 'render').map(row => row.line), [3]);
});
