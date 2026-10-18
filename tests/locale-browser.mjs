// Existing interaction suites retain their explicitly authored zh-TW selectors.
// Fresh/default locale behavior is qualified separately in i18n.browser.mjs.
import { chromium as rawChromium, webkit as rawWebkit } from 'playwright';
function wrap(type) {
 return new Proxy(type,{get(target,key){
  if(key!=='launch'){const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v;}
  return async options=>{
   const browser=await target.launch(options);
   const init=async context=>context.addInitScript(()=>{if(window.top!==window)return;try{if(!localStorage.getItem('app-canvas:locale'))localStorage.setItem('app-canvas:locale','zh-TW');localStorage.setItem('app-canvas:telemetry','false');}catch{}});
   const newContext=browser.newContext.bind(browser),newPage=browser.newPage.bind(browser);
   browser.newContext=async opts=>{const context=await newContext(opts);await init(context);return context;};
   browser.newPage=async opts=>{const page=await newPage(opts);await init(page.context());return page;};
   return browser;
  };
 }});
}
export const chromium=wrap(rawChromium),webkit=wrap(rawWebkit);
