import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { discoverSources, checkSourceCoverage } from '../lib/inventory.mjs';

const base = 'app/src/main/res/drawable/row.xml';
const replacement = 'app/src/main/res/drawable-v21/row.xml';
const build = 'app/build.gradle';
const screen = 'app/src/main/Screen.java';
const selector = '<selector><item state_pressed="true"><shape/></item><item drawable="@drawable/normal"/></selector>';
const ripple = '<ripple color="@color/pressed"><item drawable="@drawable/normal"/></ripple>';

async function fixture(t, overrides = {}, { old = base, newer = replacement } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'app-canvas-resource-sdk-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sources = {
    [build]: 'android { defaultConfig {\n minSdkVersion 21\n} }',
    [screen]: 'class Screen extends Activity { void render() { setText("Ready"); } }',
    [old]: selector,
    [newer]: ripple,
    ...overrides,
  };
  for (const [path, text] of Object.entries(sources)) {
    if (text === undefined) continue;
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  await mkdir(join(root, '.artifacts'));
  const found = await discoverSources(root);
  const isUi = path => path === screen || path === newer;
  const inventory = {
    ...found,
    files: found.files.map(f => isUi(f.path) ? f : { ...f, nonUiReason: 'Original supported minimum selects the versioned alternative; configuration retained' }),
    items: [{ id: 'ready', kind: 'screen', sources: [screen, newer], cases: ['ready'] }],
    reviews: found.obligations.map(o => isUi(o.path) ? { id: o.id, items: ['ready'] } : { id: o.id, nonUiReason: 'Source-qualified supported SDK excludes this resource selection; all obligations retained' }),
  };
  const check = async () => {
    await writeFile(join(root, '.artifacts/inventory.json'), JSON.stringify(inventory));
    return checkSourceCoverage({ catalog: [{ id: 'ready' }], sourceCoverage: { inventory: '.artifacts/inventory.json' } }, root, { complete: true });
  };
  return { root, found, inventory, check, old, newer };
}

test('source SDK dominance retains all old tags and still requires specific reviews and replacement UI', async t => {
  const f = await fixture(t);
  const old = f.found.obligations.filter(o => o.path === base);
  assert.equal(old.length, 6); // file, region, and all four original tags
  const tags = old.filter(o => o.kind === 'element');
  assert.ok(tags.every(o => o.nonRenderingConfiguration && o.resourceSelection.kind === 'android-version-shadowed-resource'));
  const proof = tags[0].resourceSelection;
  assert.equal(proof.constraint.minimum, '21');
  assert.equal(proof.constraint.buildFile, build);
  assert.equal(proof.replacement, replacement);
  assert.equal(proof.replacementSha256, f.found.files.find(x => x.path === replacement).sha256);
  assert.ok(f.found.obligations.filter(o => o.path === replacement).every(o => !o.resourceSelection && !o.nonRenderingConfiguration));
  await f.check();
  const review = f.inventory.reviews.pop();
  await assert.rejects(f.check, /source obligations unreviewed/);
  f.inventory.reviews.push(review);
  const liveTag = f.found.obligations.find(o => o.path === replacement && o.kind === 'element');
  const liveReview = f.inventory.reviews.find(o => o.id === liveTag.id);
  delete liveReview.items;
  liveReview.nonUiReason = 'Claimed replacement need not render';
  await assert.rejects(f.check, /Rendering source cannot be dismissed/);
});

test('lower, dynamic, missing or unrelated module floors cannot waive a default resource', async t => {
  for (const changes of [
    { [build]: 'minSdkVersion 19\n' },
    { [build]: 'minSdkVersion project.minimum\n' },
    { [build]: undefined, 'other/build.gradle': 'minSdkVersion 99\n' },
    { [build]: undefined, 'build.gradle': 'minSdkVersion 99\n' },
    { 'app/src/main/res/build.gradle': 'minSdkVersion 99\n' },
    { [replacement]: undefined },
    { [replacement]: undefined, 'other/src/main/res/drawable-v21/row.xml': ripple },
    { [build]: 'minSdkVersion 21\n sourceSets { main { res.srcDirs = [] } }' },
    { [build]: 'minSdkVersion 21\n sourceSets { main.res.exclude("**/row.xml") }' },
    { [build]: 'minSdkVersion 21\n productFlavors { legacy {\n minSdkVersion 19\n} }' },
    { [screen]: 'class Screen { void render() { assets.openNonAsset("res/drawable/row.xml"); } }' },
    { [screen]: 'class Screen { void render() { load("res/drawable/row.xml"); } }' },
    { [screen]: 'class Screen { void render() { load(getPackageCodePath()); } }' },
  ]) {
    const f = await fixture(t, changes);
    assert.ok(f.found.obligations.filter(o => o.path === base).every(o => !o.nonRenderingConfiguration && !o.resourceSelection));
    await assert.rejects(f.check, /Rendering source cannot be dismissed/);
  }
});

test('configuration-specific and values alternatives remain independent rendering work', async t => {
  for (const [old, newer] of [
    [base, 'app/src/main/res/drawable-land-v21/row.xml'],
    [base, 'app/src/main/res/drawable-v21/other.xml'],
    ['app/src/main/res/drawable-land/row.xml', 'app/src/main/res/drawable-land-v21/row.xml'],
    ['app/src/main/res/values/styles.xml', 'app/src/main/res/values-v21/styles.xml'],
    ['app/src/debug/res/drawable/row.xml', 'app/src/debug/res/drawable-v21/row.xml'],
  ]) {
    const f = await fixture(t, {}, { old, newer });
    assert.ok(f.found.obligations.filter(o => o.path === old).every(o => !o.nonRenderingConfiguration && !o.resourceSelection));
    await assert.rejects(f.check, /Rendering source cannot be dismissed/);
  }
});

test('version-only resources below the supported floor are shadowed without dropping IDs', async t => {
  const old = 'app/src/main/res/drawable-v19/row.xml';
  const f = await fixture(t, {}, { old });
  const tags = f.found.obligations.filter(o => o.path === old && o.kind === 'element');
  assert.ok(tags.every(o => o.resourceSelection?.resourceApi === 19 && o.resourceSelection.replacementApi === 21));
  await f.check();
  await writeFile(join(f.root, build), 'minSdkVersion 19\n');
  await assert.rejects(f.check, /Source inventory changed/);
  const live = await discoverSources(f.root);
  assert.deepEqual(live.obligations.filter(o => o.path === old).map(o => o.id), f.found.obligations.filter(o => o.path === old).map(o => o.id));
  assert.ok(live.obligations.filter(o => o.path === old).every(o => !o.nonRenderingConfiguration));
});

test('invented inventory annotations cannot waive a reachable resource', async t => {
  const f = await fixture(t, { [build]: 'minSdkVersion 19\n' });
  for (const o of f.inventory.obligations) if (o.path === base) {
    o.nonRenderingConfiguration = true;
    o.resourceSelection = { kind: 'android-version-shadowed-resource', replacement };
  }
  await assert.rejects(f.check, /Rendering source cannot be dismissed/);
});

test('cached module access checks retain per-resource direct-file loading', async t => {
  const other = 'app/src/main/res/drawable/zebra.xml';
  const f = await fixture(t, {
    [other]: selector,
    'app/src/main/res/drawable-v21/zebra.xml': ripple,
    [screen]: 'class Screen { void render() { load("res/drawable/zebra.xml"); } }',
  });
  assert.ok(f.found.obligations.filter(o => o.path === base && o.kind === 'element').every(o => o.resourceSelection));
  assert.ok(f.found.obligations.filter(o => o.path === other).every(o => !o.resourceSelection));
  await assert.rejects(f.check, /Rendering source cannot be dismissed/);
});
