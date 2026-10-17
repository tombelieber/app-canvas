import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { discoverSources } from '../lib/discovery.mjs';
import { checkDiscoveryCoverage } from '../lib/discovery-coverage.mjs';

test('inherited native UI using property assignments cannot disappear behind a support explanation', async t => {
  const root = await mkdtemp(join(tmpdir(), 'app-canvas-native-ui-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sources = {
    'ios/Question.h': '@interface Question : UIViewController\n@end',
    'ios/Question.m': '@implementation Question\n- (void)update { if (failed) { self.label.text = @"Error"; } }\n@end',
    'android/Base.java': 'class Base extends AppCompatActivity {}',
    'android/Question.java': 'class Question extends Base { void update() { if (failed) label.text = "Error"; } }',
    'android/Qualified.java': 'class Qualified extends app.shared.Base { void update() { if (failed) label.text = "Error"; } }',
    'ios/SwiftQuestion.swift': 'import SwiftUI\nstruct SwiftQuestion: View { var body: some View { Text("Error") } }',
    'android/KotlinQuestion.kt': 'class KotlinQuestion() : Base() { fun update() { if (failed) label.text = "Error" } }',
    'ios/Record.h': '@interface Record : NSObject\n@end',
    'ios/Record.m': '@implementation Record\n- (int)value { if (missing) return 0; return 1; }\n@end',
  };
  for (const [path, source] of Object.entries(sources)) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), source); }
  const found = await discoverSources(root);
  for (const path of Object.keys(sources)) {
    const subset = { issues: [], obligations: found.obligations.filter(item => item.path === path) };
    const inventory = { obligations: subset.obligations, items: [], reviews: subset.obligations.map(item => ({ id: item.id, nonUiReason: 'Non-rendering support' })) };
    if (path.includes('Record')) assert.doesNotThrow(() => checkDiscoveryCoverage(subset, inventory));
    else {
      assert.ok(subset.obligations.find(item => item.kind === 'file').nativeUi, path);
      assert.throws(() => checkDiscoveryCoverage(subset, inventory), /Rendering source cannot be dismissed/, path);
    }
  }
});

test('recorded native UI annotations cannot override freshly discovered ownership', async t => {
  const root = await mkdtemp(join(tmpdir(), 'app-canvas-native-owner-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'Question.swift'), 'class Question: UIViewController { func update() { if failed { label.text = "Error" } } }');
  const found = await discoverSources(root);
  const inventory = { obligations: found.obligations.map(item => ({ ...item, nativeUi: undefined })), items: [], reviews: found.obligations.map(item => ({ id: item.id, nonUiReason: 'Non-rendering support' })) };
  assert.throws(() => checkDiscoveryCoverage(found, inventory), /Rendering source cannot be dismissed/);
});
