import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { languages } from '../lib/locales.mjs';
import { initialLocale, translator, validateMessages } from '../ui/i18n-core.mjs';
const messages = Object.fromEntries(await Promise.all(languages.map(async l => [l, JSON.parse(await readFile(new URL(`../ui/locales/${l}.json`, import.meta.url)))])));
test('all eleven viewer locales have complete keys and matching placeholders', () => assert.equal(validateMessages(messages), true));
test('English default, explicit locale and saved preference, blocked storage', () => {
 assert.equal(initialLocale(null), 'en');
 assert.equal(initialLocale({getItem:()=> 'ja'}), 'ja');
 assert.equal(initialLocale({getItem:()=> 'ja'}, '?lang=fr'), 'fr');
 assert.equal(initialLocale({getItem:()=> 'oops'}, '?lang=oops'), 'en');
 assert.equal(initialLocale({getItem(){throw Error('blocked')}}), 'en');
});
test('count parameters and app-owned content remain intact', () => {
 const t = translator(messages,'ja');
 assert.equal(t('All cases ({0})',77),'全ケース（77）');
 assert.equal(t('{0} · real UI','Health record'), 'Health record · 実際の UI');
 assert.equal(t('Unknown app content'), 'Unknown app content');
 const bad = structuredClone(messages); bad.de['{0} screens']='Bildschirme';
 assert.throws(()=>validateMessages(bad), /invalid translation/);
});

test('viewer literal translation calls exist in the canonical dictionary', async () => {
 const { default: ts } = await import('typescript');
 for (const file of ['canvas.jsx','WorkbenchChrome.jsx','JourneyPanel.jsx','DemoPlayer.jsx','ScreenNode.jsx','PlaylistSelect.jsx','i18n.jsx','NativeOverviewPlane.jsx','OverviewPlane.jsx']) {
  const source = ts.createSourceFile(file, await readFile(new URL('../ui/'+file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const visit = node => { if(ts.isCallExpression(node) && node.expression.getText(source)==='t' && ts.isStringLiteral(node.arguments[0])) assert.ok(Object.hasOwn(messages.en,node.arguments[0].text),file+': '+node.arguments[0].text); ts.forEachChild(node,visit); }; visit(source);
 }
});
