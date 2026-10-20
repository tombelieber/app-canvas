import assert from 'node:assert/strict';
import{test}from'node:test';import{mkdtemp,rm,readFile}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{createTelemetry}from'../lib/telemetry.mjs';
test('default-on, persistent opt-out, environment controls and private event boundary',async()=>{
 const home=await mkdtemp(join(tmpdir(),'canvas-telemetry-')),sent=[];
 try{
  const make=env=>createTelemetry({home,env,version:'0.12.0',fetcher:async(url,options)=>{sent.push({url,payload:JSON.parse(options.body)});return{ok:true};}});
  const first=await make({});assert.equal(first.config().enabled,true);await first.once('install');await first.once('install');assert.equal(sent.length,1);
  assert.ok(!JSON.stringify(sent).includes(home));assert.deepEqual(Object.keys(sent[0].payload.properties).sort(),['cohort_class','product','schema_version','source','surface','version']);
  assert.equal(sent[0].payload.properties.product,'app_canvas');assert.equal(sent[0].payload.properties.schema_version,1);
  await first.capture('screen_selected',{screen:'private'});assert.equal(sent.length,1);
  await first.setEnabled(false);const second=await make({});assert.equal(second.config().enabled,false);await second.capture('viewer_ready');assert.equal(sent.length,1);
  await second.setEnabled(true);assert.equal((await make({})).config().enabled,true);
  for(const env of [{APP_CANVAS_TELEMETRY:'0'},{DO_NOT_TRACK:'1'},{CI:'true'}]){const off=await make(env);assert.equal(off.config().enabled,false);assert.equal(await off.setEnabled(true),false);await off.capture('viewer_ready');}
  assert.equal(sent.length,1);
  const saved=JSON.parse(await readFile(join(home,'.config/app-canvas/telemetry.json')));assert.equal(saved.enabled,true);assert.equal(saved.id,first.config().id);
 }finally{await rm(home,{recursive:true,force:true});}
});
test('collector failures never reject and endpoint cannot transmit to an arbitrary insecure host',async()=>{
 const home=await mkdtemp(join(tmpdir(),'canvas-telemetry-'));try{const telemetry=await createTelemetry({home,env:{},version:'0.12.0',fetcher:async()=>{throw Error('offline')}});assert.equal(await telemetry.capture('viewer_ready'),false);await assert.rejects(()=>createTelemetry({home,env:{APP_CANVAS_TELEMETRY_ENDPOINT:'http://evil.invalid'},version:'0.12.0'}),/HTTPS/);}finally{await rm(home,{recursive:true,force:true});}
});

test('parallel processes claim one install beacon and an active controller observes a persisted opt-out',async()=>{
 const home=await mkdtemp(join(tmpdir(),'canvas-telemetry-')),sent=[];
 try{const make=()=>createTelemetry({home,env:{},version:'0.12.0',fetcher:async(_url,options)=>{sent.push(JSON.parse(options.body));return{ok:true};}});const a=await make(),b=await make();await Promise.all([a.once('install'),b.once('install')]);assert.equal(sent.length,1);await b.setEnabled(false);await a.capture('viewer_ready');assert.equal(sent.length,1);}finally{await rm(home,{recursive:true,force:true});}
});

test('dogfood persists without changing identity or opt-out, and stale controllers preserve the latest audience',async()=>{
 const home=await mkdtemp(join(tmpdir(),'canvas-audience-')),sent=[];
 try{
  const make=(env={})=>createTelemetry({home,env,version:'0.12.0',fetcher:async(_url,options)=>{sent.push(JSON.parse(options.body));return{ok:true};}});
  const first=await make();await first.setEnabled(false);const originalId=first.config().id;
  const stale=await make();assert.equal(await first.setCohortClass('internal_test'),true);
  assert.equal(first.config().enabled,false);assert.equal(first.config().id,originalId);
  await first.capture('viewer_ready');assert.equal(sent.length,0);
  await stale.setEnabled(true);const restarted=await make();assert.equal(restarted.config().cohort_class,'internal_test');assert.equal(restarted.config().id,originalId);
  await stale.capture('viewer_ready',{cohort_class:'unknown'});assert.equal(sent.at(-1).properties.cohort_class,'internal_test');
  assert.equal(await restarted.setCohortClass('external'),false);
  assert.equal(await restarted.setCohortClass('unknown'),true);
  await stale.capture('viewer_ready',{cohort_class:'internal_test'});assert.equal(sent.at(-1).properties.cohort_class,'unknown');
  assert.equal((await make()).config().cohort_class,'unknown');
 }finally{await rm(home,{recursive:true,force:true});}
});

test('temporary dogfood never bypasses privacy blockers or changes persisted audience',async()=>{
 const home=await mkdtemp(join(tmpdir(),'canvas-audience-')),sent=[];
 try{
  const make=env=>createTelemetry({home,env,version:'0.12.0',fetcher:async(_url,options)=>{sent.push(JSON.parse(options.body));return{ok:true};}});
  const normal=await make({});await normal.setEnabled(true);
  const temporary=await make({APP_CANVAS_DOGFOOD:'1'});await temporary.capture('viewer_ready');assert.equal(sent.at(-1).properties.cohort_class,'internal_test');assert.equal((await make({})).config().cohort_class,'unknown');
  for(const blocker of [{CI:'true'},{DO_NOT_TRACK:'1'},{APP_CANVAS_TELEMETRY:'0'}]){
   const off=await make({...blocker,APP_CANVAS_DOGFOOD:'1'});assert.equal(await off.setCohortClass('internal_test'),true);assert.equal(off.config().enabled,false);assert.equal(await off.setEnabled(true),false);assert.equal(await off.capture('viewer_ready'),false);
   assert.equal(JSON.parse(await readFile(join(home,'.config/app-canvas/telemetry.json'))).enabled,true);
  }
  assert.equal(sent.length,1);
 }finally{await rm(home,{recursive:true,force:true});}
});

test('failed audience persistence reports failure without claiming the preference changed',async()=>{
 const home=await mkdtemp(join(tmpdir(),'canvas-audience-'));
 try{
  const {mkdir}=await import('node:fs/promises');const telemetry=await createTelemetry({home,env:{},version:'0.12.0'});
  await mkdir(join(home,'.config/app-canvas/telemetry.json.lock'),{recursive:true});
  assert.equal(await telemetry.setCohortClass('internal_test'),false);assert.equal(telemetry.config().cohort_class,'unknown');
 }finally{await rm(home,{recursive:true,force:true});}
});

test('public CLI persists the audience and status while preserving an existing opt-out and ID',async()=>{
 const home=await mkdtemp(join(tmpdir(),'canvas-audience-cli-'));
 try{
  const {spawnSync}=await import('node:child_process');
  const run=choice=>{const r=spawnSync(process.execPath,[new URL('../bin/app-canvas.mjs',import.meta.url).pathname,'telemetry',choice],{encoding:'utf8',env:{...process.env,HOME:home,APP_CANVAS_DOGFOOD:'',CI:'true'}});assert.equal(r.status,0,r.stderr);return r.stdout;};
  run('off');const path=join(home,'.config/app-canvas/telemetry.json'),before=JSON.parse(await readFile(path));
  assert.match(run('dogfood'),/Usage audience: Dogfood/);assert.match(run('status'),/Anonymous usage analytics: disabled/);
  const after=JSON.parse(await readFile(path));assert.equal(after.id,before.id);assert.equal(after.enabled,false);assert.equal(after.cohort_class,'internal_test');
  assert.match(run('unknown'),/Usage audience: Unknown/);assert.equal(JSON.parse(await readFile(path)).cohort_class,'unknown');
 }finally{await rm(home,{recursive:true,force:true});}
});
