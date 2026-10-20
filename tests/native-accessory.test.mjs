import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceObligations } from '../lib/source-obligations.mjs';
import { discoverSources, checkSourceCoverage } from '../lib/inventory.mjs';

const source = `@interface DeferredForm : UIViewController
@end
@implementation DeferredForm
- (void)viewDidLoad {
  [self makeField];
  toolbar = [[UIToolbar alloc] initWithFrame:CGRectZero];
  done = [[UIBarButtonItem alloc] initWithBarButtonSystemItem:UIBarButtonSystemItemDone target:self action:@selector(closeInput)];
}
- (void)makeField {
  field.inputAccessoryView = toolbar;
  if (enabled) [label setText:name];
}
@end
`;
const surfaces = (text, extension = '.m') => sourceObligations(text, extension).filter(item => item.details.nativeUiSurface);

test('deferred toolbar allocation and later attachment each enter the native worklist', () => {
  assert.deepEqual(surfaces(source).map(item => [item.kind, item.start, item.details.nativeUiSurface, item.details.nativeUiRole]), [
    ['candidate', 6, 'UIToolbar', 'allocation'],
    ['candidate', 7, 'UIBarButtonItem', 'allocation'],
    ['presentation', 10, 'inputAccessoryView', 'attachment'],
  ]);
});

test('Objective-C new/message syntax and Swift construction/property syntax are inspected', () => {
  const objc = '[UIToolbar new];\n[UIBarButtonItem new];\n[field setInputAccessoryView:toolbar];';
  assert.equal(surfaces(objc, '.mm').length, 3);
  const swift = 'let toolbar = UIKit.UIToolbar()\nlet done = UIBarButtonItem()\nfield.inputAccessoryView = toolbar';
  assert.equal(surfaces(swift, '.swift').length, 3);
  assert.equal(surfaces(swift, '.java').length, 0);
});

test('comments, literals, declarations and comparisons do not invent allocations or attachment', () => {
  const masked = `// field.inputAccessoryView = [UIToolbar new];
/* [[UIBarButtonItem alloc] init]; */
NSString *note = @"PRIVATE-MARKER [UIToolbar new] field.inputAccessoryView = x";
UIToolbar *toolbar;
BOOL same = field.inputAccessoryView == toolbar;
`;
  assert.deepEqual(surfaces(masked), []);
  assert.ok(!JSON.stringify(sourceObligations(masked, '.m')).includes('PRIVATE-MARKER'));
});

test('new native sites are additive and strict source acceptance rejects the old incomplete inventory', async t => {
  const root = await mkdtemp(join(tmpdir(), 'canvas-deferred-accessory-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'DeferredForm.m'), source);
  const discovery = await discoverSources(root);
  // Pinned from the pre-accessory scanner on this unchanged source. New sites
  // must not invalidate or renumber any existing source review.
  const oldIds = [
    'a153178ef9e538f5cdd137e8564d29b74bff05b8062f4d1472681ad2d243b51f',
    '39ce8da0bd16ebbcc43dc8e3c233163d6036c94104e25da6d2cbc009ba5e2cf8',
    '92a61833ec8ff60056df4727d61561f4bfe83d67a7e5c493e948b78c7417b7eb',
    'b03de5b0c2460bdb0a214a67c868bd560ece30d6ce231bffd1b956b6b3ee0aad',
    '3b748db3c832096390e091f35b69bef2f047a01a5d06d971df6323faac497f67',
  ];
  assert.deepEqual(discovery.obligations.filter(item => !item.nativeUiRole).map(item => item.id), oldIds);
  const added = discovery.obligations.filter(item => item.nativeUiRole);
  assert.equal(added.length, 3);
  const items = ['initial-yes', 'initial-no', 'accessory'].map(id => ({ id, kind: 'state', platform: 'ios', sources: ['DeferredForm.m'], cases: [id] }));
  const reviews = discovery.obligations.map(item => ({ id: item.id, items: [item.nativeUiRole ? 'accessory' : item.outcome === 'false' ? 'initial-no' : 'initial-yes'] }));
  const project = { catalog: items.map(item => ({ id: item.id })), sourceCoverage: { inventory: 'inventory.json' } };
  async function save(obligations, reviewRows, semanticItems = items) {
    await writeFile(join(root, 'inventory.json'), JSON.stringify({ ...discovery, sourceRoot: '.', obligations, reviews: reviewRows, items: semanticItems }));
  }
  await save(discovery.obligations.filter(item => oldIds.includes(item.id)), reviews.filter(row => oldIds.includes(row.id)), items.filter(item => item.id !== 'accessory'));
  await assert.rejects(() => checkSourceCoverage(project, root, { complete: true }), /Source discovery obligations changed/);
  await save(discovery.obligations, reviews.filter(row => oldIds.includes(row.id)));
  await assert.rejects(() => checkSourceCoverage(project, root, { complete: true }), /3 source obligations unreviewed/);
  await save(discovery.obligations, reviews);
  const result = await checkSourceCoverage(project, root, { complete: true });
  assert.deepEqual(result.requiredEvidence.accessory.map(item => item.id), added.map(item => item.id));
  const attachment = added.find(item => item.kind === 'presentation');
  await save(discovery.obligations, reviews.map(row => row.id === attachment.id ? { id: row.id, nonUiReason: 'Only looked at its initial nil value' } : row));
  await assert.rejects(() => checkSourceCoverage(project, root, { complete: true }), /Rendering source cannot be dismissed/);
});
