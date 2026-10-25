import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitizeEvent } from '../lib/telemetry-contract.mjs';
import { createTelemetry } from '../lib/telemetry.mjs';

const event = properties => ({id: '00000000-0000-4000-8000-000000000001', event: 'viewer_ready', properties: {surface: 'real_project', version: '0.13.1', ...properties}});

test('deployment environment and self-declared cohort are independent closed dimensions', () => {
  const normalized = sanitizeEvent(event({environment: 'production', cohort_class: 'internal_test'}));
  assert.equal(normalized?.properties.environment, 'production');
  assert.equal(normalized?.properties.cohort_class, 'internal_test');
  for (const value of ['Dogfood', 'External', 'internal_test']) assert.equal(sanitizeEvent(event({environment: value})), null);
  for (const value of ['production', 'external', 'Dogfood']) assert.equal(sanitizeEvent(event({cohort_class: value})), null);
  assert.equal(sanitizeEvent(event({audience: 'External'})), null);
});

test('legacy payloads remain accepted and unclassified; qualification cannot impersonate production', () => {
  assert.equal(sanitizeEvent(event({}))?.properties.environment, 'unknown');
  assert.equal(sanitizeEvent(event({}))?.properties.cohort_class, 'unknown');
  assert.equal(sanitizeEvent(event({surface: 'qualification', environment: 'production', cohort_class: 'internal_test'}))?.properties.environment, 'qualification');
});

test('unknown distribution is accepted without asserting an installer and arbitrary source labels fail closed', () => {
  assert.equal(sanitizeEvent(event({source: 'unknown'}))?.properties.source, 'unknown');
  assert.equal(sanitizeEvent(event({source: 'npm-or-maybe-github'})), null);
});

test('CLI stamps environment and cohort after caller properties without changing installation or opt-out', async () => {
  const home = await mkdtemp(join(tmpdir(), 'canvas-dimensions-'));
  const sent = [];
  try {
    const make = env => createTelemetry({home, env, version: '0.13.1', fetcher: async (_url, options) => {sent.push(JSON.parse(options.body)); return {ok: true};}});
    const first = await make({APP_CANVAS_ENVIRONMENT: 'staging', APP_CANVAS_COHORT_CLASS: 'internal_test'});
    await first.capture('viewer_ready', {environment: 'production', cohort_class: 'unknown'});
    assert.equal(sent[0].properties.environment, 'staging');
    assert.equal(sent[0].properties.cohort_class, 'internal_test');
    await first.once('install');
    const second = await make({});
    assert.equal(second.config().id, first.config().id);
    await second.capture('viewer_ready');
    assert.equal(sent.at(-1).properties.environment, 'production');
    assert.equal(sent.at(-1).properties.cohort_class, 'unknown');
    await second.setEnabled(false);
    assert.equal(await first.capture('viewer_ready'), false);
  } finally {await rm(home, {recursive: true, force: true});}
});
