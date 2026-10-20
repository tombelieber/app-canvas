import {spawn,execFileSync}from'node:child_process';import{createServer}from'node:net';import{mkdtemp,rm,writeFile,mkdir}from'node:fs/promises';import{tmpdir}from'node:os';import{join,resolve}from'node:path';
import {buildLaunch}from'../scripts/build-launch.mjs';
const wrangler=resolve('services/cloud/node_modules/wrangler/bin/wrangler.js'),state=await mkdtemp(join(tmpdir(),'app-canvas-cloud-'));
const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
let worker,log='';
try{
 await mkdir('.artifacts/launch',{recursive:true});
 // Standalone checks must not silently serve a previous release's pages.
 if(!process.env.APP_CANVAS_STATIC_DIR){process.env.APP_CANVAS_STATIC_DIR=join(state,'site');await buildLaunch(process.env.APP_CANVAS_STATIC_DIR);}
 execFileSync(process.execPath,[wrangler,'d1','migrations','apply','DB','--local','--persist-to',state],{cwd:'services/cloud',stdio:'pipe'});
 worker=spawn(process.execPath,[wrangler,'dev','--ip','127.0.0.1','--port',String(port),'--var','LOCAL_TEST:1','--persist-to',state],{cwd:'services/cloud',env:{...process.env,NO_COLOR:'1',CI:'1'},stdio:['ignore','pipe','pipe']});
 await new Promise((yes,no)=>{const timeout=setTimeout(()=>no(Error('Worker readiness timeout')),30000);const output=chunk=>{log+=chunk;if(log.includes('Ready on http://127.0.0.1:')){clearTimeout(timeout);yes();}};worker.stdout.on('data',output);worker.stderr.on('data',output);worker.once('error',no);worker.once('exit',code=>{clearTimeout(timeout);no(Error('Worker stopped: '+code));});});
 process.env.CLOUD_TEST_URL=`http://127.0.0.1:${port}`;await import('./waitlist.browser.mjs');
}finally{worker?.kill('SIGTERM');if(worker&&worker.exitCode===null)await new Promise(resolve=>worker.once('exit',resolve));await writeFile('.artifacts/launch/waitlist-runtime.log',log);await rm(state,{recursive:true,force:true});}
