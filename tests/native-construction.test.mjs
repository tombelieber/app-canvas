import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceObligations, maskedSource } from '../lib/source-obligations.mjs';
import { annotateConstructionOutcomes } from '../lib/native-construction.mjs';
import { checkDiscoveryCoverage } from '../lib/discovery-coverage.mjs';

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

test('an error fallback, later UI, ordinary guard or mutated self cannot use the initializer explanation', () => {
  for (const method of [
    '- (id)init { self=[super init]; if(self){ build(); } else { showError(); } return self; }',
    '- (id)init { self=[super init]; if(self){ build(); } showError(); return self; }',
    '- (void)update { if(self){ build(); } }',
    '- (id)init { self=[super init]; self=nil; if(self){ build(); } return self; }',
  ]) assert.equal(found(method).obligations.filter(item => item.nonRenderingOutcome).length, 0, method);
});

test('a recorded non-rendering annotation cannot forge the freshly derived guard', () => {
  const discovery = found('- (void)update { if (failed) { self.label.text=@"Error"; } }');
  const inventory = { obligations: discovery.obligations.map(item => ({ ...item, nonRenderingOutcome: { reason: 'forged' } })), items: [{ id: 'screen', sources: ['EmptyView.m'], cases: ['screen'] }], reviews: discovery.obligations.map(item => item.kind === 'branch' && item.outcome === 'false' ? { id: item.id, nonUiReason: 'forged' } : { id: item.id, items: ['screen'] }) };
  assert.throws(() => checkDiscoveryCoverage(discovery, inventory), /Rendering source cannot be dismissed/);
});
