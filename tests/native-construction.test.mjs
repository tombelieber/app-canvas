import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceObligations, maskedSource } from '../lib/source-obligations.mjs';
import { annotateConstructionOutcomes } from '../lib/native-construction.mjs';
import { checkDiscoveryCoverage } from '../lib/discovery-coverage.mjs';
import { discoverSources, checkSourceCoverage } from '../lib/inventory.mjs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function found(body) {
  const source = `@implementation EmptyView\n${body}\n@end`;
  const obligations = [{ id: 'file', kind: 'file', path: 'EmptyView.m', nativeUi: { classes: ['EmptyView'] } }, ...sourceObligations(source, '.m').map((item, index) => ({ id: String(index), path: 'EmptyView.m', kind: item.kind, ...item.details }))];
  annotateConstructionOutcomes(maskedSource(source), obligations);
  return { issues: [], obligations };
}

test('a nil initializer outcome still needs explanation, while its UI construction needs a case', () => {
  const discovery = found('- (instancetype)init { self = [super init]; if (self) { self.label.text = @"Empty"; } return self; }');
  const outcomes = discovery.obligations.filter(item => item.kind === 'branch');
  assert.ok(outcomes.find(item => item.outcome === 'false').nonRenderingOutcome);
  assert.ok(!outcomes.find(item => item.outcome === 'true').nonRenderingOutcome);
  const inventory = { obligations: discovery.obligations, items: [{ id: 'empty', sources: ['EmptyView.m'], cases: ['empty'] }], reviews: discovery.obligations.map(item => item.nonRenderingOutcome ? { id: item.id, nonUiReason: 'No view is constructed when this canonical initializer returns nil; caller failure handling remains separately required.' } : { id: item.id, items: ['empty'] }) };
  assert.doesNotThrow(() => checkDiscoveryCoverage(discovery, inventory));
  inventory.reviews = inventory.reviews.filter(review => review.items);
  assert.throws(() => checkDiscoveryCoverage(discovery, inventory), /unreviewed/);
});

test('a parameterized native initializer can explain its nil outcome without fabricating a screen', () => {
  const discovery = found('- (id)initWithNibName:(NSString *)name bundle:(NSBundle *)bundle { self = [super initWithNibName:name bundle:bundle]; if (self) { self.label.text = @"Ready"; } return self; }');
  const inventory = { obligations: discovery.obligations, items: [{ id: 'ready', sources: ['EmptyView.m'], cases: ['ready'] }], reviews: discovery.obligations.map(item => item.kind === 'branch' && item.outcome === 'false' ? { id: item.id, nonUiReason: 'This initializer returns nil; no controller is constructed on this outcome. Caller failure behavior remains separately required.' } : { id: item.id, items: ['ready'] }) };
  assert.doesNotThrow(() => checkDiscoveryCoverage(discovery, inventory));
  inventory.reviews = inventory.reviews.filter(review => review.items);
  assert.throws(() => checkDiscoveryCoverage(discovery, inventory), /unreviewed/);
});

test('an empty canonical self guard has no branch-local UI effect but still requires its owner UI', () => {
  const discovery = found('- (id)initWithNibName:(id)name bundle:(id)bundle { self=[super initWithNibName:name bundle:bundle]; if(self){ /* no custom initialization */ } return self; }');
  const yes = discovery.obligations.find(item => item.kind === 'branch' && item.outcome === 'true');
  assert.equal(yes.nonRenderingOutcome?.kind, 'empty-initializer-guard');
  const inventory = { obligations: discovery.obligations, items: [{ id: 'owner', sources: ['EmptyView.m'], cases: ['owner'] }], reviews: discovery.obligations.map(item => item.nonRenderingOutcome ? { id: item.id, nonUiReason: item.nonRenderingOutcome.reason } : { id: item.id, items: ['owner'] }) };
  assert.doesNotThrow(() => checkDiscoveryCoverage(discovery, inventory));
  inventory.reviews.find(review => review.id === 'file').nonUiReason = 'The branch was empty';
  delete inventory.reviews.find(review => review.id === 'file').items;
  assert.throws(() => checkDiscoveryCoverage(discovery, inventory), /Rendering source cannot be dismissed/);
});

test('statements, fallbacks, returns and later code never receive the empty-guard proof', () => {
  for (const method of [
    '- (id)init { self=[super init]; if(self){ [self buildContent]; } return self; }',
    '- (id)init { self=[super init]; if(self){ self.ready=YES; } return self; }',
    '- (id)init { self=[super init]; if(self){ return other; } return self; }',
    '- (id)init { self=[super init]; if(self){} else { showError(); } return self; }',
    '- (id)init { self=[super init]; if(self){} showError(); return self; }',
    '- (void)update { if(self){} }',
  ]) assert.ok(!found(method).obligations.find(item => item.kind === 'branch' && item.outcome === 'true').nonRenderingOutcome, method);
});

test('the source coverage entry re-derives empty guards and rejects a forged annotation after a UI statement is added', async t => {
  const root = await mkdtemp(join(tmpdir(), 'canvas-empty-init-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.artifacts'));
  const project = { catalog: [{ id: 'owner' }], sourceCoverage: { inventory: '.artifacts/inventory.json' } };
  async function snapshot(body) {
    await writeFile(join(root, 'EmptyView.m'), `@interface EmptyView : UIViewController\n@end\n@implementation EmptyView\n- (id)init { self=[super init]; if(self){ ${body} } return self; }\n@end`);
    const discovery = await discoverSources(root);
    return { ...discovery, items: [{ id: 'owner', kind: 'screen', sources: ['EmptyView.m'], cases: ['owner'] }], reviews: discovery.obligations.map(item => item.nonRenderingOutcome ? { id: item.id, nonUiReason: item.nonRenderingOutcome.reason } : item.kind === 'exclusion' ? { id: item.id, nonUiReason: 'Generated inventory artifacts only' } : { id: item.id, items: ['owner'] }) };
  }
  await writeFile(join(root, '.artifacts/inventory.json'), JSON.stringify(await snapshot('')));
  assert.equal((await checkSourceCoverage(project, root, { complete: true })).cases, 1);
  const changed = await snapshot('self.view.backgroundColor = UIColor.redColor;');
  const yes = changed.obligations.find(item => item.kind === 'branch' && item.outcome === 'true');
  yes.nonRenderingOutcome = { kind: 'empty-initializer-guard' };
  const review = changed.reviews.find(item => item.id === yes.id);
  delete review.items; review.nonUiReason = 'Forged empty guard';
  await writeFile(join(root, '.artifacts/inventory.json'), JSON.stringify(changed));
  await assert.rejects(() => checkSourceCoverage(project, root, { complete: true }), /Rendering source cannot be dismissed/);
});

test('an error fallback, later UI, ordinary guard or mutated self cannot use the initializer explanation', () => {
  for (const method of [
    '- (id)init { self=[super init]; if(self){ build(); } else { showError(); } return self; }',
    '- (id)init { self=[super init]; if(self){ build(); } showError(); return self; }',
    '- (void)update { if(self){ build(); } }',
    '- (id)init { self=[super init]; self=nil; if(self){ build(); } return self; }',
    '- (id)initWithNibName:(id)name bundle:(id)bundle { self=[super initWithNibName:name bundle:bundle]; if(self){ build(); } else { showError(); } return self; }',
    '- (id)initialize { self=[super initialize]; if(self){ build(); } return self; }',
  ]) assert.equal(found(method).obligations.filter(item => item.nonRenderingOutcome).length, 0, method);
});

test('a recorded non-rendering annotation cannot forge the freshly derived guard', () => {
  const discovery = found('- (void)update { if (failed) { self.label.text=@"Error"; } }');
  const inventory = { obligations: discovery.obligations.map(item => ({ ...item, nonRenderingOutcome: { reason: 'forged' } })), items: [{ id: 'screen', sources: ['EmptyView.m'], cases: ['screen'] }], reviews: discovery.obligations.map(item => item.kind === 'branch' && item.outcome === 'false' ? { id: item.id, nonUiReason: 'forged' } : { id: item.id, items: ['screen'] }) };
  assert.throws(() => checkDiscoveryCoverage(discovery, inventory), /Rendering source cannot be dismissed/);
});
