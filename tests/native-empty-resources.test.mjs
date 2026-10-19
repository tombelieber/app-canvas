import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { discoverSources, checkSourceCoverage } from '../lib/inventory.mjs';

const resource = 'app/src/main/res/values-sw720dp-land/dimens.xml';
const screen = 'app/src/main/Screen.java';
async function fixture(t, xml, path = resource) {
  const root = await mkdtemp(join(tmpdir(), 'app-canvas-empty-values-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(dirname(join(root, path)), { recursive: true });
  await mkdir(join(root, '.artifacts'));
  await writeFile(join(root, path), xml);
  await mkdir(dirname(join(root, screen)), { recursive: true });
  await writeFile(join(root, screen), 'class Screen extends Activity { void render() { setText("Ready"); } }');
  const found = await discoverSources(root);
  const inventory = { ...found, items: [{ id: 'screen', kind: 'screen', sources: [screen], cases: ['ready'] }],
    files: found.files.map(file => file.path === screen ? file : { ...file, nonUiReason: 'Empty values container declares no resources' }),
    reviews: found.obligations.map(item => item.path === screen ? { id: item.id, items: ['screen'] } : { id: item.id, nonUiReason: item.kind === 'exclusion' ? 'Generated review output' : 'Empty values container declares no resources' }),
  };
  const check = async () => {
    await writeFile(join(root, '.artifacts/inventory.json'), JSON.stringify(inventory));
    return checkSourceCoverage({ catalog: [{ id: 'ready' }], sourceCoverage: { inventory: '.artifacts/inventory.json' } }, root, { complete: true });
  };
  return { root, found, inventory, check, path };
}

test('complete acceptance accounts for a genuinely empty Android values container without inventing a UI case', async t => {
  for (const xml of [
    '<resources>\n<!-- <dimen name="margin">24dp</dimen> -->\n</resources>\n',
    '<?xml version="1.0" encoding="utf-8"?>\n<resources/>',
    '\uFEFF<resources> <!-- no overrides --> </resources>',
  ]) {
    const f = await fixture(t, xml);
    assert.equal(f.found.obligations.filter(o => o.kind === 'element').length, 1);
    await assert.doesNotReject(f.check);
    assert.equal(f.inventory.items.length, 1);
    assert.ok(f.inventory.items.every(item => !item.sources.includes(resource)));
  }
});

test('active values, attributes, opaque XML and other resource directories retain rendering obligations', async t => {
  for (const [xml, path] of [
    ['<resources><dimen name="margin">24dp</dimen></resources>', resource],
    ['<resources><style name="Screen"><item name="android:textColor">#fff</item></style></resources>', resource],
    ['<resources><color name="foreground">#fff</color></resources>', resource],
    ['<resources xmlns:tools="http://schemas.android.com/tools"/>', resource],
    ['<resources name="visible"/>', resource],
    ['<resources>visible text</resources>', resource],
    ['<resources><![CDATA[<dimen name="margin">24dp</dimen>]]></resources>', resource],
    ['<!DOCTYPE resources [<!ENTITY child "visible">]><resources>&child;</resources>', resource],
    ['<resources><!-- invalid -- comment --></resources>', resource],
    ['<resources><?custom instruction?></resources>', resource],
    ['<resources/>trailing', resource],
    ['<resources><resources/></resources>', resource],
    ['<resources>', resource],
    ['<!--before declaration--><?xml version="1.0"?><resources/>', resource],
    ['<resources/>', 'app/src/main/res/layout/empty.xml'],
    ['<resources/>', 'app/src/main/assets/values/empty.xml'],
  ]) {
    const f = await fixture(t, xml, path);
    assert.ok(f.found.obligations.filter(o => o.kind === 'element').every(o => !o.nonRenderingConfiguration), `${path}: ${xml}`);
    await assert.rejects(f.check, /Rendering source cannot be dismissed/);
  }
});

test('recorded empty-container annotations cannot waive active values in fresh discovery', async t => {
  const f = await fixture(t, '<resources><dimen name="margin">24dp</dimen></resources>');
  for (const item of f.inventory.obligations) item.nonRenderingConfiguration = true;
  await assert.rejects(f.check, /Rendering source cannot be dismissed/);
});

test('adding a real value invalidates a previously reviewed empty container', async t => {
  const f = await fixture(t, '<resources/>');
  await f.check();
  await writeFile(join(f.root, f.path), '<resources><dimen name="margin">24dp</dimen></resources>');
  await assert.rejects(f.check, /source inventory.*changed|discovery obligations changed/i);
});
