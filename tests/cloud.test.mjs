import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { handle } from '../services/cloud/worker.mjs';
import { sanitizeEvent } from '../lib/telemetry-contract.mjs';
const database = new DatabaseSync(':memory:');database.exec(await readFile(new URL('../services/cloud/migrations/0001_waitlist.sql',import.meta.url),'utf8'));database.exec(await readFile(new URL('../services/cloud/migrations/0002_event_budget.sql',import.meta.url),'utf8'));
const DB={prepare(sql){let args=[];return{bind(...values){args=values;return this;},async run(){return{meta:{changes:Number(database.prepare(sql).run(...args).changes)}};},async first(){return database.prepare(sql).get(...args);}};}};
const env={DB,WAITLIST_LIMIT:{limit:async()=>({success:true})},EVENT_LIMIT:{limit:async()=>({success:true})}};
const request=(path,input,origin='https://tombelieber.github.io')=>new Request('https://service.invalid'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(input)});
const signup={email:'canary@example.com',locale:'en',consent:true,company:''};
test('waitlist requires allowed origin, explicit consent, valid data; no content leakage',async()=>{
 for(const [req,status]of [[request('/waitlist',signup,'https://evil.invalid'),403],[request('/waitlist',{...signup,consent:false}),400],[request('/waitlist',{...signup,email:'not mail'}),400],[request('/waitlist',{...signup,locale:'xx'}),400],[request('/waitlist',{...signup,extra:'private'}),400]])assert.equal((await handle(req,env)).status,status);
 assert.equal(database.prepare('select count(*) as n from waitlist').get().n,0);
});
test('registration is deduplicated, records consent, supports credential-bound removal',async()=>{
 const first=await(await handle(request('/waitlist',signup),env)).json();assert.ok(first.ok&&first.removalToken);
 await handle(request('/waitlist',{...signup,email:'CANARY@EXAMPLE.COM'}),env);
 assert.equal(database.prepare('select count(*) as n from waitlist').get().n,1);
 const row=database.prepare('select * from waitlist').get();assert.equal(row.is_test,1);assert.equal(row.consent_version,'2026-10');assert.ok(row.removal_hash!==first.removalToken);
 await handle(request('/waitlist/remove',{email:signup.email,token:'a'.repeat(64)}),env);assert.equal(database.prepare('select count(*) as n from waitlist').get().n,1);
 await handle(request('/waitlist/remove',{email:signup.email,token:first.removalToken}),env);assert.equal(database.prepare('select count(*) as n from waitlist').get().n,0);
});
test('rate limit, honeypot and daily capacity bound writes',async()=>{
 assert.equal((await handle(request('/waitlist',signup),{...env,WAITLIST_LIMIT:{limit:async()=>({success:false})}})).status,429);
 await handle(request('/waitlist',{...signup,company:'bot'}),env);assert.equal(database.prepare('select count(*) as n from waitlist').get().n,0);
 database.prepare('update daily_budget set submissions=500').run();assert.equal((await handle(request('/waitlist',signup),env)).status,429);
});
test('analytics allowlist rejects PII, arbitrary events, URLs and identifiers',()=>{
 const event={id:crypto.randomUUID(),event:'viewer_ready',properties:{surface:'real_project',version:'0.12.0',locale:'en'}};
 assert.ok(sanitizeEvent(event));
 for(const extra of [{email:'private@example.com'},{path:'/private/repo'},{screen:'patient-42'},{url:'https://private.invalid'},{error:'private stack'}])assert.equal(sanitizeEvent({...event,properties:{...event.properties,...extra}}),null);
 assert.equal(sanitizeEvent({...event,event:'free form private event'}),null);
 assert.equal(sanitizeEvent({...event,properties:{...event.properties,surface:'landing'}}),null);
 assert.equal(sanitizeEvent({...event,properties:{...event.properties,product:'another_tool'}}),null);
 assert.equal(sanitizeEvent({...event,properties:{...event.properties,schema_version:2}}),null);
 assert.equal(sanitizeEvent(event).properties.cohort_class,'unknown');
 assert.equal(sanitizeEvent({...event,properties:{...event.properties,cohort_class:'internal_test'}}).properties.cohort_class,'internal_test');
 for(const cohort_class of ['external','Dogfood',true,{},null])assert.equal(sanitizeEvent({...event,properties:{...event.properties,cohort_class}}),null);
});

test('shared OSS capture enforces product attribution and product-scoped identities',async t=>{
 let sent;
 t.mock.method(globalThis,'fetch',async(_url,options)=>{sent=JSON.parse(options.body);return Response.json({status:1});});
 const id=crypto.randomUUID(),input={id,event:'viewer_ready',properties:{surface:'qualification',version:'0.12.0',source:'local'}};
 const response=await handle(request('/capture',input),{...env,POSTHOG_TOKEN:'test-ingest-token'});
 assert.equal(response.status,200);assert.equal(sent.distinct_id,`app_canvas:${id}`);
 assert.equal(sent.properties.product,'app_canvas');assert.equal(sent.properties.schema_version,1);
 assert.equal(sent.properties.$process_person_profile,false);assert.equal(sent.properties.$geoip_disable,true);assert.equal(sent.properties.$ip,null);
 assert.equal((await handle(request('/capture',{...input,properties:{...input.properties,product:'another_tool'}}),{...env,POSTHOG_TOKEN:'test-ingest-token'})).status,400);
 t.mock.method(globalThis,'fetch',async()=>Response.json({status:1,quota_limited:['product_analytics']}));
 assert.equal((await handle(request('/capture',input),{...env,POSTHOG_TOKEN:'test-ingest-token'})).status,503);
});

test('invalid and oversized JSON fail before database writes', async()=>{
 const before=database.prepare('select count(*) as n from waitlist').get().n;
 for(const text of ['{','x'.repeat(2200)]){const response=await handle(new Request('https://service.invalid/waitlist',{method:'POST',headers:{Origin:'https://tombelieber.github.io','Content-Type':'application/json'},body:text}),env);assert.equal(response.status,400);}
 assert.equal(database.prepare('select count(*) as n from waitlist').get().n,before);
});

test('Cloudflare canonical origin is allowed while sibling and preview origins fail closed', async t => {
 let sent;
 t.mock.method(globalThis,'fetch',async(_url,options)=>{sent=JSON.parse(options.body);return Response.json({status:1});});
 const event_id=crypto.randomUUID(), occurred_at=new Date().toISOString();
 const input={id:crypto.randomUUID(),event:'reference_copied',event_id,occurred_at,properties:{surface:'official_demo',version:'0.16.0',source:'browser',environment:'production',cohort_class:'internal_test',session_id:crypto.randomUUID(),acquisition_source:'reddit_showcase',campaign:'oss_launch'}};
 const response=await handle(request('/capture',input,'https://agent-canvas-app.pages.dev'),{...env,POSTHOG_TOKEN:'test-token'});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://agent-canvas-app.pages.dev');
 assert.equal(sent.uuid,event_id);assert.equal(sent.timestamp,occurred_at);
 assert.equal(sent.properties.product,'app_canvas');assert.equal(sent.properties.$process_person_profile,false);
 for(const origin of ['https://other.pages.dev','https://preview.agent-canvas-app.pages.dev','https://agent-canvas-app.pages.dev.evil.invalid'])assert.equal((await handle(request('/capture',input,origin),{...env,POSTHOG_TOKEN:'test-token'})).status,403);
});

test('reference outcomes and correlation metadata remain bounded, private and backwards compatible',()=>{
 const input={id:crypto.randomUUID(),event:'reference_copy_failed',properties:{surface:'real_project',version:'0.16.0',error_code:'clipboard_unavailable'}};
 assert.ok(sanitizeEvent(input));
 for(const extra of [{error_code:'private stack'},{acquisition_source:'private-campaign'},{campaign:'secret'},{session_id:'/private/path'}])assert.equal(sanitizeEvent({...input,properties:{...input.properties,...extra}}),null);
 assert.equal(sanitizeEvent({...input,event_id:'secret'}),null);
 assert.equal(sanitizeEvent({...input,occurred_at:'private'}),null);
 assert.equal(sanitizeEvent({...input,properties:{...input.properties,error_code:undefined}}),null);
 assert.equal(sanitizeEvent({...input,event:'reference_copied'}),null);
 assert.ok(sanitizeEvent({...input,event:'flow_failed',properties:{...input.properties,error_code:'journey_failed'}}));
 assert.equal(sanitizeEvent({...input,event:'flow_failed'}),null);
});
