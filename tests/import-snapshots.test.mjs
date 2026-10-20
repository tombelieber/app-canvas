import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotCache} from '../lib/import/snapshots.mjs';

const deferred = () => Promise.withResolvers();
test('concurrent viewer requests share one landscape load and reuse its revision', async () => {
  const gate=deferred(), started=deferred(); let reads=0, revision=1;
  const cache=snapshotCache({metadata:async()=>({revision}),read:async()=>{reads++;started.resolve();await gate.promise;return {project:{revision}};}});
  const first=cache.refresh(); await started.promise;
  const others=Array.from({length:8},()=>cache.refresh());
  assert.equal(reads,1); gate.resolve();
  const results=await Promise.all([first,...others]);
  assert.ok(results.every(x=>x===results[0]));
  assert.equal(await cache.refresh(),results[0]); assert.equal(reads,1);
  revision=2;assert.equal((await cache.refresh()).project.revision,2);assert.equal(reads,2);
});
test('save and watcher refresh share the saved snapshot without another full read', async () => {
  const entered=deferred(), finish=deferred();let reads=0,revision=1;
  const cache=snapshotCache({metadata:async()=>({revision}),read:async()=>{reads++;return {project:{revision}};}});
  await cache.refresh();
  const saved={project:{revision:2},documents:{saved:true}};
  const update=cache.update(async()=>{entered.resolve();await finish.promise;revision=2;return saved;});
  await entered.promise;const watcher=cache.refresh(),request=cache.refresh();finish.resolve();
  assert.deepEqual(await Promise.all([update,watcher,request]),[saved,saved,saved]);
  assert.equal(await cache.refresh(),saved);assert.equal(reads,1);
});
test('writes wait for in-flight reads, serialize, and recover after failed writes', async () => {
  const entered=deferred(),finish=deferred();let revision=1,writes=0;
  const cache=snapshotCache({metadata:async()=>({revision}),read:async()=>{entered.resolve();await finish.promise;return {project:{revision}};}});
  const first=cache.refresh();await entered.promise;
  const update=()=>cache.update(async()=>{writes++;return {project:{revision:++revision}};});
  const one=update(),two=update();assert.equal(writes,0);finish.resolve();
  await first;assert.equal((await one).project.revision,2);assert.equal((await two).project.revision,3);assert.equal(writes,2);
  await assert.rejects(cache.update(async()=>{throw Error('Write rejected');}),/rejected/);
  assert.equal((await cache.refresh()).project.revision,3);
});

test('a source change during an older read is delivered once after that read', async () => {
  const entered=deferred(),finish=deferred();let revision=1,reads=0;
  const cache=snapshotCache({metadata:async()=>({revision}),read:async()=>{reads++;const observed=revision;entered.resolve();await finish.promise;return {project:{revision:observed}};}});
  const first=cache.refresh();await entered.promise;revision=2;
  const changed=cache.changed(),second=cache.changed();finish.resolve();
  assert.equal((await first).project.revision,1);
  const results=await Promise.all([changed,second]);assert.equal(results[0].project.revision,2);assert.equal(results[0],results[1]);
  assert.equal(reads,2,'one materialized load per actual revision');
});
