import assert from "node:assert/strict";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";

const { outputFiles } = await build({ bundle: true, write: false, format: "esm", define: { "process.env.NODE_ENV": '"production"' }, stdin: {
  resolveDir: process.cwd(), loader: "jsx", contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {ReactFlowProvider,useStoreApi} from '@xyflow/react';
    import {usePreviewMembership} from './ui/usePreviewMembership.js';
    const nodes=[100,10000].map((x,i)=>({id:i?'far':'near',type:'screen',position:{x,y:20},data:{visible:true,height:844,domUrl:'/source'}}));
    const input={nodes,area:{width:800,height:600},retained:[],limit:4,playing:false};
    function Probe(){
      window.workbenchRenders=(window.workbenchRenders||0)+1;
      const membership=usePreviewMembership(input);
      window.members=[...membership.previews];
      return <output>{window.members.join(',')}</output>;
    }
    function Controls(){const store=useStoreApi();window.move=x=>store.setState({transform:[x,0,.1]});return null;}
    createRoot(document.getElementById('root')).render(<ReactFlowProvider><Probe/><Controls/></ReactFlowProvider>);
  `,
} });
const server = createServer((req, res) => {
  res.setHeader("Content-Type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? outputFiles[0].contents : '<div id="root"></div><script type="module" src="/app.js"></script>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(() => window.move);
      const move = x => page.evaluate(async x => { move(x); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }, x);
      await move(0);
      assert.deepEqual(await page.evaluate(() => members), ["near"]);
      const before = await page.evaluate(() => workbenchRenders);
      for (let x = 1; x <= 30; x++) await move(x);
      assert.equal(await page.evaluate(() => workbenchRenders), before, "camera movement within the same visible set must not rerender the workbench");
      await move(-1000);
      assert.deepEqual(await page.evaluate(() => members), ["far"], "an equal-size membership replacement must update the workbench");
      assert.equal(await page.evaluate(() => workbenchRenders), before + 1);
      console.log(`PASS ${engine.name()}: 30 camera updates skip workbench rendering; crossing a source boundary updates once.`);
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
