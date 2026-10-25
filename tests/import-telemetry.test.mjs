import './fixtures/import-storage.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../lib/import/store.mjs';
import { startImportCanvas } from '../lib/import/server.mjs';
import { createTelemetry } from '../lib/telemetry.mjs';

test('import viewer binds safe events to its CLI identity, respects opt-out and defaults off for library callers', async t => {
  const root = await mkdtemp(join(tmpdir(), 'canvas-import-analytics-'));
  const directory = join(root, 'project');
  const store = await createStore(directory, { create: true, allowEphemeral: true });
  const sent = [];
  const telemetry = await createTelemetry({ home: join(root, 'home'), env: {}, version: '0.16.0', surface: 'qualification', fetcher: async (_url, options) => { sent.push(JSON.parse(options.body)); return { ok: true }; } });
  const app = await startImportCanvas({ directory: store.root, port: 0, telemetry });
  t.after(async () => { await app.close(); await rm(root, { recursive: true, force: true }); });
  const config = await (await fetch(app.address + '/telemetry.json')).json();
  assert.equal(config.id, telemetry.config().id); assert.equal(config.local, true);
  const event_id = crypto.randomUUID(), occurred_at = new Date().toISOString();
  const event = { id: config.id, event: 'reference_copied', event_id, occurred_at, properties: { surface: 'real_project', version: '0.16.0', source: 'browser', environment: 'production', cohort_class: 'unknown' } };
  const post = (path, body, origin = app.address) => fetch(app.address + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post('/telemetry', event, 'https://evil.invalid')).status, 403);
  assert.equal((await post('/telemetry', { ...event, id: crypto.randomUUID() })).status, 400);
  assert.equal((await post('/telemetry', { ...event, properties: { ...event.properties, selector: 'private' } })).status, 400);
  assert.equal((await post('/telemetry', event)).status, 204);
  assert.equal(sent.length, 1); assert.equal(sent[0].event_id, event_id); assert.equal(sent[0].occurred_at, occurred_at);
  assert.equal(sent[0].properties.surface, 'qualification'); assert.equal(sent[0].properties.environment, 'qualification');
  assert.equal((await post('/telemetry/preference', { enabled: false })).status, 204);
  assert.equal((await post('/telemetry', event)).status, 503);
  assert.equal(sent.length, 1);
  await app.close();
  const plain = await startImportCanvas({ directory: store.root, port: 0 });
  try {
    assert.deepEqual(await (await fetch(plain.address + '/telemetry.json')).json(), { enabled: false, configurable: false });
    assert.equal((await fetch(plain.address + '/telemetry', { method: 'POST', headers: { Origin: plain.address, 'Content-Type': 'application/json' }, body: JSON.stringify(event) })).status, 403);
  } finally { await plain.close(); }
});
