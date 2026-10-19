import { useEffect, useRef, useState } from 'react';
const choiceKey='app-canvas:telemetry';
export function useTelemetry(locale) {
 const current=useRef(null),[config,setConfig]=useState(null);
 useEffect(()=>{
  let cancelled=false;
  fetch(new URL('../telemetry.json',import.meta.url)).then(r=>r.ok?r.json():null).then(c=>{
   if(cancelled||!c)return;
   if(c.enabled&&!c.id){try{const key='app-canvas:anonymous-id';const id=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,id);c={...c,id};}catch{c={...c,enabled:false};}}
   try{if(localStorage.getItem(choiceKey)==='false')c={...c,enabled:false};}catch{c={...c,enabled:false};}
   if(navigator.doNotTrack==='1'||navigator.globalPrivacyControl)c={...c,enabled:false,configurable:false};
   current.current=c;setConfig(c);
  }).catch(()=>{});
  return()=>{cancelled=true;};
 },[]);
 const track=(event,properties={})=>{
  const c=current.current;if(!c?.enabled)return;
  fetch(new URL(c.endpoint,location.href),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:c.id,event,properties:{surface:c.surface,version:c.version,source:c.source,locale,...properties,cohort_class:c.cohort_class==='internal_test'?'internal_test':'unknown'}}),referrerPolicy:'no-referrer',signal:AbortSignal.timeout(3000)}).catch(()=>{});
 };
 const previous=useRef(null);
 useEffect(()=>{if(!config)return;const first=previous.current===null; if(first)track('viewer_ready');else if(previous.current!==locale)track('locale_changed');previous.current=locale;},[config,locale]);
 const toggle=async enabled=>{
  const c=current.current;if(!c?.configurable)return;
  // Persist the opt-out before any further event can be emitted.
  current.current={...c,enabled:false};setConfig({...c,enabled,pending:true});
  try{
   localStorage.setItem(choiceKey,String(enabled));
   if(c.local){const response=await fetch('./telemetry/preference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});if(!response.ok)throw Error("preference");}
   current.current={...c,enabled};setConfig(current.current);
  }catch{setConfig({...c,enabled:false,error:true});}
 };
 return {config,track,toggle};
}
