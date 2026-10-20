import test from 'node:test';
import assert from 'node:assert/strict';
import { planCaptures, populationFingerprint } from '../lib/population-plan.mjs';
const request = { caseId: 'one', stateId: 'form-ready', pageId: 'form', feature: 'Input', entry: 'FormController', platform: 'ios', layout: 'phone', locale: 'en', sourceDigest: 'source', buildFingerprint: 'build', viewport: { width: 390, height: 844 }, inputs: { name: 'Synthetic' }, steps: ['enter', 'retry', 'recreate-field'], observe: ['toolbar'] };

test('proof-only requests share exact captures and union read-only observations', () => {
  const result = planCaptures([request, { ...request, caseId: 'two', observe: ['keyboard'] }, { ...request, caseId: 'three', observe: ['toolbar'] }]);
  assert.equal(result.cases, 3); assert.equal(result.captures, 1); assert.equal(result.reused, 2);
  assert.deepEqual(result.jobs[0].observe, ['keyboard', 'toolbar']);
  assert.equal(result.groups[0].states, 1); assert.equal(result.groups[0].cases.length, 3);
  assert.equal(result.surfaces.length, 1); assert.deepEqual(result.surfaces[0].evidenceCases, ['one', 'two', 'three']);
  assert.deepEqual(result.caseMap, { one: 'one', two: 'one', three: 'one' });
});

test('different lifetimes, layouts, state, data, locale, source and build never collapse', () => {
  for (const change of [{ steps: ['enter'] }, { stateId: 'error' }, { layout: 'tablet' }, { platform: 'android' }, { locale: 'zh-TW' }, { viewport: { width: 768, height: 1024 } }, { sourceDigest: 'changed' }, { buildFingerprint: 'new-build' }, { inputs: { name: 'Other' } }])
    assert.equal(planCaptures([request, { ...request, ...change, caseId: 'two' }]).captures, 2);
});

test('fingerprints are stable JSON, never lossy function/undefined/NaN or cyclic hashes', () => {
  assert.equal(populationFingerprint({ a: 1, b: [2] }), populationFingerprint({ b: [2], a: 1 }));
  const cyclic = {}; cyclic.self = cyclic;
  for (const invalid of [{ a: undefined }, { a: () => {} }, { a: NaN }, cyclic, new Date(), Array(1), { [Symbol()]: 'hidden' }]) assert.throws(() => populationFingerprint(invalid), /JSON/);
  assert.throws(() => planCaptures([request, request]), /unique/);
});
