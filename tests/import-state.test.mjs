import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from '../lib/import/store.mjs';
import {startImportCanvas} from '../lib/import/server.mjs';
import {captureFixture} from './fixtures/import-model.mjs';

test('HTTP state never mixes new capture metadata with an older materialized snapshot', async t => {
  const root=await mkdtemp(join(tmpdir(),'canvas-state-revision-'));
  const store=await createStore(join(root,'project'),{create:true}); let inject=true;
  const wrapped={...store, async read() {
    const state=await store.read();
    if(inject){inject=false;await store.capture(captureFixture());}
    return state;
  }};
  const app=await startImportCanvas({directory:store.root,port:0,session:{store:wrapped,status:{phase:'recording'},ready:new Promise(()=>{}),subscribe(){},async close(){}}});
  t.after(async()=>{await app.close();await rm(root,{recursive:true,force:true});});
  const first=await(await fetch(app.address+'/api/import/state')).json();
  assert.equal(first.project.revision,first.manifest.revision,'metadata and documents must come from one accepted snapshot');
  assert.equal(first.project.screens.length,first.screens.length);
  const next=await(await fetch(app.address+'/api/import/state')).json();
  assert.equal(next.project.revision,next.manifest.revision);
  assert.equal(next.screens.length,1);
});

test('materialized snapshots keep immutable base metadata across save and capture', async t => {
  const root=await mkdtemp(join(tmpdir(),'canvas-state-base-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const store=await createStore(join(root,'project'),{create:true});
  let current=await store.capture(captureFixture()); const id=current.project.screens[0].id;
  current=await store.save({expectedRevision:current.project.revision,history:[{type:'duplicateScreen',screenId:id,newId:'alternative',value:'Design alternative'}],cursor:1});
  assert.equal(current.baseProject.screens.length,1);assert.equal(current.project.screens.length,2);
  const next=captureFixture('second');next.document.root.children[0].children[0].text='Another screen';
  current=await store.capture(next);
  assert.equal(current.baseProject.screens.length,2);assert.equal(current.project.screens.length,3);
  assert.equal(current.baseProject.revision,current.project.revision);
  const reopened=await store.read();assert.deepEqual(reopened.baseProject,current.baseProject);
});
