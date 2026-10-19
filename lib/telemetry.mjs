import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sanitizeEvent } from './telemetry-contract.mjs';
export const officialEndpoint = 'https://app-canvas-services.vickyai-tech.workers.dev/capture';
export async function createTelemetry({ env = process.env, home = homedir(), fetcher = fetch, version, source = 'local', surface = 'real_project' } = {}) {
 const blocked = env.APP_CANVAS_TELEMETRY === '0' || env.DO_NOT_TRACK === '1' || !!env.CI;
 const directory = join(home, '.config/app-canvas'), path = join(directory,'telemetry.json');
 let saved = {}; try { saved = JSON.parse(await readFile(path,'utf8')); } catch {}
 let id = /^[a-f0-9-]{36}$/.test(saved.id || '') ? saved.id : randomUUID();
 let enabled = !blocked && saved.enabled !== false;
 const cohort = value => value === 'internal_test' ? 'internal_test' : 'unknown';
 const cohortClass = () => env.APP_CANVAS_DOGFOOD === '1' ? 'internal_test' : cohort(saved.cohort_class);
 let endpoint = env.APP_CANVAS_TELEMETRY_ENDPOINT || officialEndpoint;
 const url = new URL(endpoint);
 if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === '127.0.0.1')) throw Error('Telemetry endpoint must use HTTPS');
 async function persist(preference, claim, audience) {
  await mkdir(directory,{recursive:true,mode:0o700});const lock=path+'.lock';let owned=false;
  for(let i=0;i<5;i++){try{await mkdir(lock);owned=true;break;}catch(e){if(e.code!=='EEXIST')throw e;await new Promise(resolve=>setTimeout(resolve,20));}}
  if(!owned)throw Error('Preference is busy');
  try{
   let latest={};try{latest=JSON.parse(await readFile(path,'utf8'));}catch{}
   if(claim && latest.sent?.includes(claim))return false;
   if(/^[a-f0-9-]{36}$/.test(latest.id||''))id=latest.id;
   const optedIn=preference??latest.enabled??saved.enabled??true;
   enabled=!blocked&&optedIn;
   saved={...latest,...saved,id,enabled:optedIn,cohort_class:audience??cohort(latest.cohort_class??saved.cohort_class),notified:latest.notified||saved.notified,sent:[...new Set([...(latest.sent||[]),...(saved.sent||[])])].slice(-31)};
   const temp=path+`.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(saved)+'\n',{mode:0o600});await rename(temp,path);return true;
  }finally{await rm(lock,{recursive:true,force:true});}
 }
 async function capture(event, properties = {}) {
  if (!enabled || blocked) return false;
  try { const latest = JSON.parse(await readFile(path,'utf8')); if (latest.enabled === false) return false; saved.cohort_class = cohort(latest.cohort_class); } catch {}
  const payload = sanitizeEvent({id,event,properties:{...properties,version,source,surface,cohort_class:cohortClass()}});
  if (!payload) return false;
  try { return (await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(2500)})).ok; } catch { return false; }
 }
 async function once(event) {
  if (!enabled) return;
  const key=`${event}:${version}:${source}`;
  if (saved.sent?.includes(key)) return;
  saved.sent=[...(saved.sent||[]).slice(-30),key];
  try { if(!await persist(undefined,key))return; } catch { return; }
  await capture(event);
 }
 return {
  config: () => ({enabled,configurable:!blocked,id,version,source,surface,cohort_class:cohortClass(),endpoint:'./telemetry'}),
  capture,
  async setCohortClass(value) { if (!['internal_test','unknown'].includes(value)) return false; try { await persist(undefined,undefined,value); return true; } catch { return false; } },
  async setEnabled(value) { if(blocked&&value===true)return false;enabled=value===true;try{await persist(value===true);return true;}catch{enabled=false;return false;} },
  async notice() {if(!blocked&&!saved.notified){console.error('App Canvas sends minimal anonymous usage events. No app content, source or paths. Opt out: app-canvas telemetry off or APP_CANVAS_TELEMETRY=0. See docs/telemetry.md.');saved.notified=true;try{await persist();}catch{enabled=false;}}},
  once,
 };
}
