import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import { sanitizeEvent } from '../lib/telemetry-contract.mjs';

const script = await readFile(new URL('../launch/analytics.js', import.meta.url), 'utf8');
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), values };
}
function run({ local = storage(), session = storage(), dnt = false, blocked = false, search = '', referrer = '' } = {}) {
  const sent = [], listeners = {}, choiceListeners = {};
  const choice = { checked: false, disabled: false, addEventListener: (name, callback) => { choiceListeners[name] = callback; } };
  const document = { body: { dataset: { version: '0.16.0', locale: 'en', page: 'product' } }, documentElement: { lang: 'en' }, referrer, getElementById: () => choice, addEventListener: (name, callback) => { listeners[name] = callback; } };
  const localStorage = blocked ? { getItem() { throw Error('storage blocked'); }, setItem() { throw Error('storage blocked'); } } : local;
  vm.runInNewContext(script, { document, navigator: { doNotTrack: dnt ? '1' : '0' }, location: { search }, localStorage, sessionStorage: session, crypto: { randomUUID }, URLSearchParams, URL, Set, Date, JSON, AbortSignal, fetch: (_url, request) => { sent.push(JSON.parse(request.body)); return Promise.resolve({ ok: true }); } });
  return { sent, choice, change: enabled => { choice.checked = enabled; choiceListeners.change(); }, click: action => listeners.click({ target: { closest: () => ({ dataset: { action } }) } }) };
}

test('landing attribution is enum-only and same-origin pages keep one browser/session identity', () => {
  const local = storage(), session = storage();
  const first = run({ local, session, search: '?ac_source=reddit_showcase&ac_campaign=oss_launch&email=private@example.com', referrer: 'https://www.reddit.com/r/private?token=secret' });
  assert.equal(first.sent.length, 1);
  assert.equal(first.sent[0].properties.acquisition_source, 'reddit_showcase');
  assert.equal(first.sent[0].properties.campaign, 'oss_launch');
  assert.ok(sanitizeEvent(first.sent[0]));
  first.click('demo'); first.click('private-event');
  assert.equal(first.sent.length, 2);
  const second = run({ local, session, search: '?ac_source=founder_social&ac_campaign=build_in_public' });
  assert.equal(second.sent[0].id, first.sent[0].id);
  assert.equal(second.sent[0].properties.session_id, first.sent[0].properties.session_id);
  assert.equal(second.sent[0].properties.acquisition_source, 'reddit_showcase');
  assert.notEqual(second.sent[0].event_id, first.sent[0].event_id);
  assert.doesNotMatch(JSON.stringify(first.sent), /private|secret|email|reddit\.com|token/);
});

test('privacy blockers prevent event transmission and identifier creation; opt-out interrupts later clicks', () => {
  for (const options of [{ dnt: true }, { blocked: true }, { local: storage({ 'app-canvas:telemetry': 'false' }) }]) {
    const result = run(options); result.click('demo');
    assert.equal(result.sent.length, 0);
    if (options.local) assert.equal(options.local.getItem('app-canvas:anonymous-id'), null);
  }
  const local = storage(), result = run({ local });
  result.change(false); result.click('demo');
  assert.equal(result.sent.length, 1);
  const id = result.sent[0].id;
  const restart = run({ local }); restart.change(true); restart.click('start');
  assert.equal(restart.sent[0].id, id);
});

test('unknown attribution stays unknown and cannot smuggle arbitrary saved context', () => {
  const result = run({ search: '?ac_source=https://private.invalid&ac_campaign=private-campaign' });
  assert.equal(result.sent[0].properties.acquisition_source, 'unknown');
  assert.equal(result.sent[0].properties.campaign, 'unknown');
  const local = storage({ 'app-canvas:attribution': JSON.stringify({ acquisition_source: 'github_release', campaign: 'oss_launch', email: 'secret@example.com' }) });
  const saved = run({ local });
  assert.ok(sanitizeEvent(saved.sent[0]));
  assert.doesNotMatch(JSON.stringify(saved.sent), /secret@example/);
});
