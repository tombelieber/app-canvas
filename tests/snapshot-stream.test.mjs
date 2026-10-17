import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { snapshotStream } from '../lib/snapshot-stream.mjs';

function response(results = []) {
  return Object.assign(new EventEmitter(), {
    frames: [], ended: false,
    write(frame) { this.frames.push(frame); return results.length ? results.shift() : true; },
    end() { this.ended = true; },
  });
}

test('a blocked client retains only the latest snapshot and serializes it after drain', () => {
  const res = response([false, true]);
  const stream = snapshotStream(res);
  let serialized = 0;
  for (let revision = 0; revision < 20_000; revision++) stream.push(() => { serialized++; return String(revision); });
  assert.deepEqual(res.frames, ['0']);
  assert.equal(serialized, 1);
  res.emit('drain');
  assert.deepEqual(res.frames, ['0', '19999']);
  assert.equal(serialized, 2);
});

test('repeated backpressure eventually delivers the terminal status', () => {
  const res = response([false, false, true]);
  const stream = snapshotStream(res);
  stream.push(() => 'building-1');
  stream.push(() => 'building-2');
  res.emit('drain');
  stream.push(() => 'building-3');
  stream.push(() => 'ready');
  assert.deepEqual(res.frames, ['building-1', 'building-2']);
  res.emit('drain');
  assert.deepEqual(res.frames, ['building-1', 'building-2', 'ready']);
});

test('one blocked subscriber does not block another subscriber', () => {
  const slow = response([false]), fast = response();
  const streams = [snapshotStream(slow), snapshotStream(fast)];
  for (const frame of ['first', 'middle', 'ready']) for (const stream of streams) stream.push(() => frame);
  assert.deepEqual(fast.frames, ['first', 'middle', 'ready']);
  assert.deepEqual(slow.frames, ['first']);
  slow.emit('drain');
  assert.deepEqual(slow.frames, ['first', 'ready']);
});

for (const event of ['close', 'error']) test(`${event} discards pending snapshots and removes listeners`, () => {
  const res = response([false]);
  let removed = 0;
  const stream = snapshotStream(res, () => removed++);
  stream.push(() => 'first');
  stream.push(() => { assert.fail('closed stream must not serialize pending data'); });
  res.emit(event, new Error('disconnected'));
  res.emit('drain');
  stream.push(() => { assert.fail('closed stream must not accept data'); });
  assert.equal(removed, 1);
  assert.equal(res.listenerCount('drain'), 0);
  assert.equal(res.listenerCount('close'), 0);
  assert.deepEqual(res.frames, ['first']);
});

test('ending a stream closes its response and releases pending data once', () => {
  const res = response([false]);
  let removed = 0;
  const stream = snapshotStream(res, () => removed++);
  stream.push(() => 'first');
  stream.push(() => { assert.fail('ended stream must not serialize pending data'); });
  stream.end(); stream.end(); res.emit('drain');
  assert.equal(res.ended, true);
  assert.equal(removed, 1);
  assert.equal(res.listenerCount('drain'), 0);
});
