import assert from 'node:assert/strict';
import{test}from'node:test';import{mkdtemp,rm,readFile}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{createTelemetry}from'../lib/telemetry.mjs';
test('default-on, persistent opt-out, environment controls and private event boundary',async()=>{
 const home=await mkdtemp(join(tmpdir(),'canvas-telemetry-')),sent=[];
 try{
  const make=env=>createTelemetry({home,env,version:'0.12.0',fetcher:async(url,options)=>{sent.push({url,payload:JSON.parse(options.body)});return{ok:true};}});
  const first=await make({});assert.equal(first.config().enabled,true);await first.once('install');await first.once('install');assert.equal(sent.length,1);
  assert.ok(!JSON.stringify(sent).includes(home));assert.deepEqual(Object.keys(sent[0].payload.properties).sort(),['product','schema_version','source','surface','version']);
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
