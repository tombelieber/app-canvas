const root=document.querySelector('#cloud'),copy=JSON.parse(document.querySelector('#cloud-copy').textContent);
const endpoint='https://app-canvas-services.vickyai-tech.workers.dev';
for(const [id,path]of [['waitlist-form','/waitlist'],['remove-form','/waitlist/remove']]){
 const form=document.getElementById(id),status=form.querySelector('[role="status"]'),button=form.querySelector('button');
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!form.reportValidity())return;button.disabled=true;status.textContent=copy.pending;
  const data=new FormData(form),payload=path==='/waitlist'?{email:data.get('email'),locale:root.dataset.locale,consent:form.elements.consent.checked,company:data.get('company')}:{email:data.get('email'),token:data.get('token')};
  try{
   const response=await fetch(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('submit');const result=await response.json();if(!result.ok)throw Error('submit');
   status.textContent=path==='/waitlist'?copy.success:copy.removed;
   if(result.removalToken){const note=form.querySelector('.removal-code');note.hidden=false;note.querySelector('code').textContent=result.removalToken;}
   form.reset();
  }catch{status.textContent=copy.failure;}finally{button.disabled=false;}
 });
}
const preference=document.getElementById('analytics-choice');let id,enabled=false;
try{enabled=localStorage.getItem('app-canvas:telemetry')!=='false';id=localStorage.getItem('app-canvas:anonymous-id')||crypto.randomUUID();localStorage.setItem('app-canvas:anonymous-id',id);}catch{}
const blocked=navigator.doNotTrack==='1'||navigator.globalPrivacyControl;
if(blocked)enabled=false;preference.checked=enabled;preference.disabled=!!blocked;
function track(event,extra={}){if(!enabled||!id)return;fetch(endpoint+'/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,event,properties:{environment:'production',surface:'landing',version:root.dataset.version,locale:root.dataset.locale,page:document.body.dataset.page,source:'browser',...extra}}),credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(3000)}).catch(()=>{});}
preference.addEventListener('change',()=>{enabled=preference.checked;try{localStorage.setItem('app-canvas:telemetry',String(enabled));}catch{enabled=false;preference.checked=false;}});
track('landing_view');
for(const anchor of document.querySelectorAll('[data-action]'))anchor.addEventListener('click',()=>track('landing_cta',{action:anchor.dataset.action}));
