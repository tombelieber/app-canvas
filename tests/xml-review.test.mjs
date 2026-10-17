import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceObligations } from '../lib/source-obligations.mjs';
import { checkDiscoveryCoverage } from '../lib/discovery-coverage.mjs';

function discovered(path, content, extension) {
  return { issues: [], obligations: sourceObligations(content, extension, { path }).map((item, index) => ({ id: String(index), path, kind: item.kind, start: item.start, ...item.details })) };
}

test('structural IDE XML still needs review but can be explained as non-rendering configuration', () => {
  const found = discovered('android/.idea/compiler.xml', '<project><component name="CompilerConfiguration"><bytecodeTargetLevel target="17"/></component></project>', '.xml');
  const inventory = { obligations: found.obligations, items: [], reviews: [] };
  assert.throws(() => checkDiscoveryCoverage(found, inventory), /unreviewed/);
  inventory.reviews = found.obligations.map(item => ({ id: item.id, nonUiReason: 'IDE bytecode compiler configuration; no application layout, resource or destination declaration' }));
  assert.equal(checkDiscoveryCoverage(found, inventory).reviewed, 3);
});

test('native UI XML and JSX elements cannot use the structural-configuration explanation', () => {
  for (const [path, content, extension] of [
    ['android/res/layout/login.xml', '<LinearLayout><TextView/></LinearLayout>', '.xml'],
    ['android/res/xml/settings.xml', '<PreferenceScreen><SwitchPreference/></PreferenceScreen>', '.xml'],
    ['android/res/values/strings.xml', '<resources><string name="error">Denied</string></resources>', '.xml'],
    ['ios/Login.storyboard', '<document><scenes><scene><objects><viewController/></objects></scene></scenes></document>', '.storyboard'],
    ['web/Login.tsx', 'const Login = () => <div>Denied</div>;', '.tsx'],
    ['custom/project.xml', '<project><component/></project>', '.xml'],
    ['android/.idea/unexpected.xml', '<project><activity/></project>', '.xml'],
  ]) {
    const found = discovered(path, content, extension);
    const inventory = { obligations: found.obligations, items: [], reviews: found.obligations.map(item => ({ id: item.id, nonUiReason: 'Configuration' })) };
    assert.throws(() => checkDiscoveryCoverage(found, inventory), /Rendering source cannot be dismissed/, path);
  }
});
