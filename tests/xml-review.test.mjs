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
    ['ios/App-Info.plist', '<plist><dict><key>UILaunchStoryboardName</key><string>Launch</string></dict></plist>', '.plist'],
    ['ios/ArchivedView.plist', '<plist><dict><key>$classname</key><string>UIView</string></dict></plist>', '.plist'],
    ['ios/ArchivedNavigation.plist', '<plist><dict><key>$classname</key><string>UINavigationController</string></dict></plist>', '.plist'],
    ['ios/Permission.plist', '<plist><dict><key>NSUserTrackingUsageDescription</key><string>Allow tracking</string></dict></plist>', '.plist'],
    ['android/res/layout/embedded-policy.xml', '<LinearLayout><data-extraction-rules/></LinearLayout>', '.xml'],
    ['android/res/layout/lint.xml', '<lint><issue/></lint>', '.xml'],
    ['android/lint.xml', '<lint><button/></lint>', '.xml'],
    ['android/layout.xml', '<lint><issue/></lint>', '.xml'],
  ]) {
    const found = discovered(path, content, extension);
    const inventory = { obligations: found.obligations, items: [], reviews: found.obligations.map(item => ({ id: item.id, nonUiReason: 'Configuration' })) };
    assert.throws(() => checkDiscoveryCoverage(found, inventory), /Rendering source cannot be dismissed/, path);
  }
});

test('Android lint configuration needs source review without a fabricated UI case', () => {
  for(const content of ['<lint/>','<lint><issue id="UnusedResources"><ignore path="generated/**"/></issue></lint>']) {
    const found=discovered('android/app/lint.xml',content,'.xml');
    const inventory={obligations:found.obligations,items:[],reviews:[]};
    assert.throws(()=>checkDiscoveryCoverage(found,inventory),/unreviewed/);
    inventory.reviews=found.obligations.map(item=>({id:item.id,nonUiReason:'Android static lint analysis configuration outside runtime resources; source inspected, no view/layout declarations'}));
    assert.doesNotThrow(()=>checkDiscoveryCoverage(found,inventory));
  }
});

test('property-list data and platform backup policy retain explicit non-UI review', () => {
  for (const [path, content, extension] of [
    ['ios/SavedPreferences.plist', '<plist><dict><key>Enabled</key><true/></dict></plist>', '.plist'],
    ['ios/UnitTests-Info.plist', '<plist><dict><key>CFBundlePackageType</key><string>BNDL</string></dict></plist>', '.plist'],
    ['android/res/xml/data_rules.xml', '<data-extraction-rules><cloud-backup><exclude domain="file" path="."/></cloud-backup></data-extraction-rules>', '.xml'],
  ]) {
    const found = discovered(path, content, extension);
    const inventory = { obligations: found.obligations, items: [], reviews: [] };
    assert.throws(() => checkDiscoveryCoverage(found, inventory), /unreviewed/);
    inventory.reviews = found.obligations.map(item => ({ id: item.id, nonUiReason: 'Data serialization or platform backup policy; application display and restoration behavior remain separate UI obligations' }));
    assert.doesNotThrow(() => checkDiscoveryCoverage(found, inventory));
  }
});
