import assert from "node:assert/strict";
import { chromium, webkit } from "./locale-browser.mjs";
import { overviewDocument } from "../ui/overview-document.js";

const source = { fonts: "", background: "white", html: `<!doctype html><html><head><style>
html,body{margin:0;width:390px;height:844px;font:16px/20px Arial}
main{padding:17px;border:1px solid gray}p{width:123px}input,select,button{font:inherit;border:1px solid gray;padding:7px}
nav{position:absolute;bottom:0;width:390px;height:64px;background:#ffffffe0;backdrop-filter:blur(12px)}
</style></head><body><main><p>Source text must retain its original wrapping at every zoom.</p><input value="Synthetic"><select><option>Original control</option></select><button>Original button</button></main><nav>Source backdrop</nav></body></html>` };

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage();
    await page.route("http://canvas.test/**", route => route.fulfill({ contentType: "text/html", body: route.request().url().endsWith("overview.html") ? overviewDocument("renderer-test") : '<iframe sandbox="allow-scripts" src="/overview.html" width="1000" height="900"></iframe>' }));
    await page.goto("http://canvas.test/");
    const frame = page.frames().find(frame => frame.url().endsWith("overview.html"));
    const send = messages => page.evaluate(messages => {
      for (const message of messages) document.querySelector("iframe").contentWindow.postMessage({ channel: "app-canvas-overview", token: "test", ...message }, "*");
    }, messages);
    const camera = zoom => send([{ command: "camera", viewport: { x: 0, y: 0, zoom } }]);
    await send([{ command: "layout", items: [{ id: "source", x: 0, y: 0, width: 390, height: 844, visible: true }] }, { command: "camera", viewport: { x: 0, y: 0, zoom: 1 } }, { command: "document", id: "source", document: source }]);
    await frame.locator('[data-preview][data-ready="true"]').waitFor({ state: "attached" });
    const effect = () => frame.locator("nav").evaluate(el => getComputedStyle(el).backdropFilter);
    const full = () => frame.waitForFunction(() => getComputedStyle(document.querySelector('[data-preview]').shadowRoot.querySelector("nav")).backdropFilter !== "none");
    await full();
    const metrics = () => frame.locator('[data-preview]').evaluate(host => {
      const origin = host.getBoundingClientRect(), scale = origin.width / 390;
      return [...host.shadowRoot.querySelectorAll("p,input,select,button")].map(el => {
        const rect = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el);
        return { x: (rect.x - origin.x) / scale, y: (rect.y - origin.y) / scale, width: rect.width / scale, height: rect.height / scale, lines: range.getClientRects().length };
      });
    });
    const reference = await metrics();
    await frame.evaluate(() => {
      globalThis.cameraEffects = [];
      addEventListener("message", event => {
        if (event.data?.channel === "app-canvas-overview" && event.data.command === "camera") {
          const nav = document.querySelector('[data-preview]').shadowRoot.querySelector("nav");
          cameraEffects.push({ zoom: event.data.viewport.zoom, effect: getComputedStyle(nav).backdropFilter });
        }
      });
    });
    for (const zoom of [.015, .05, .1, .25, .5, 1, 5]) {
      await camera(zoom);
      await frame.waitForFunction(zoom => cameraEffects.at(-1)?.zoom === zoom, zoom);
      assert.equal(await frame.evaluate(() => cameraEffects.at(-1).effect), "none", "camera movement must defer expensive backdrop effects");
      const actual = await metrics();
      for (let i = 0; i < reference.length; i++) {
        assert.equal(actual[i].lines, reference[i].lines, `${engine.name()}: camera zoom must not reflow source text`);
        for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(actual[i][key] - reference[i][key]) < .05, `${engine.name()}: source ${key} changed at ${zoom}: ${JSON.stringify(actual[i])}`);
      }
      if (zoom * 390 >= 120) await full();
      else {
        await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
        assert.equal(await effect(), "none", "thumbnail effects stay reduced after idle");
      }
    }
    await camera(1);
    await camera(.05);
    await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 220)));
    assert.equal(await effect(), "none", "an old idle callback must not restore effects at overview zoom");
    await camera(1); await full();
    assert.equal(await effect(), "blur(12px)", "idle detail restores the original CSS effect");
    console.log(`PASS ${engine.name()}: unchanged source text/form layout from 1.5% to 500%; thumbnail/motion effects and idle recovery.`);
  } finally { await browser.close(); }
}
