import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, webkit } from "./locale-browser.mjs";

const bundle = await build({ stdin: { contents: 'import { actionRunner } from "./lib/frame-actions.js"; window.runCanvasAction = actionRunner();', resolveDir: process.cwd() }, bundle: true, write: false, format: "iife" });
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<input id="other"><button id="delete">Delete</button><output></output>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(() => {
      window.clicks = 0;
      document.querySelector("#delete").onclick = () => {
        clicks++;
        document.querySelector("output").textContent = document.activeElement.id === "delete" ? "deleted" : "wrong focus";
      };
      // A dialog closing, app render or host control may restore focus during
      // the cue delay. Activation must still have normal user-click focus.
      const observer = new MutationObserver(records => {
        if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && node.hasAttribute("data-canvas-demo-pointer")))) document.querySelector("#other").focus();
      });
      observer.observe(document.body, { childList: true });
    });
    await page.evaluate(() => runCanvasAction({ type: "click", selector: "#delete", presentation: { delay: 30 } }));
    assert.equal(await page.locator("output").innerText(), "deleted", `${engine.name()}: cue-time focus restoration must not change activation semantics`);
    assert.equal(await page.evaluate(() => clicks), 1, "perform the mutation once; never retry it to recover focus");
    console.log(`PASS ${engine.name()}: presentation restores target focus immediately before exactly one activation.`);
  } finally { await browser.close(); }
}
