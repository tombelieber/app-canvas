const root=document.querySelector('#cloud'),copyNode=document.querySelector('#cloud-copy'),copy=copyNode?JSON.parse(copyNode.textContent):{};
const endpoint='https://app-canvas-services.vickyai-tech.workers.dev';
for(const [id,path]of [['waitlist-form','/waitlist'],['remove-form','/waitlist/remove']]){
 const form=document.getElementById(id);if(!form)continue;const status=form.querySelector('[role="status"]'),button=form.querySelector('button');
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!form.reportValidity())return;button.disabled=true;status.textContent=copy.pending;
  const data=new FormData(form),payload=path==='/waitlist'?{email:data.get('email'),locale:root?.dataset.locale||document.body.dataset.locale,consent:form.elements.consent.checked,company:data.get('company')}:{email:data.get('email'),token:data.get('token')};
  try{
   const response=await fetch(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('submit');const result=await response.json();if(!result.ok)throw Error('submit');
   status.textContent=path==='/waitlist'?copy.success:copy.removed;
   if(result.removalToken){const note=form.querySelector('.removal-code');note.hidden=false;note.querySelector('code').textContent=result.removalToken;}
   form.reset();
  }catch{status.textContent=copy.failure;}finally{button.disabled=false;}
 });
}
