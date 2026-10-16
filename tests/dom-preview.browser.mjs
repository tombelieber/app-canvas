import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startCanvas } from "../lib/server.mjs";

const image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const config = {
  title: "Source DOM overview", groups: [{ id: "app", title: "App" }],
  catalog: [{ id: "html", title: "HTML", group: "app" }, { id: "drawing", title: "Drawing", group: "app" }],
  flows: [], preview: async ({ canvasOrigin }) => ({ url: s => `${canvasOrigin}/frame?id=${s.id}`, handle(req, res, url) {
    if (url.pathname === "/asset.png") { res.setHeader("Content-Type", "image/png"); res.end(Buffer.from(image, "base64")); return true; }
    if (url.pathname === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end('body{background:rgb(232,241,244)}h1{color:rgb(31,91,106)}.art{background-image:url("/asset.png")}'); return true; }
    if (url.pathname !== "/frame") return false;
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html><html><head><link rel="stylesheet" href="/style.css"><style></style></head><body>${url.searchParams.get("id") === "drawing" ? '<canvas width="200" height="200"></canvas>' : ""}<h1>Real source UI</h1><label>Value<input id="value"></label><input type="checkbox"><textarea></textarea><select><option>One</option><option>Two</option></select><div class="art">CSS resource</div><svg width="30" height="30"><rect width="30" height="30" fill="teal"/></svg><img id="photo" alt="Synthetic sample"><button id="save" onclick="document.querySelector('output').textContent=document.querySelector('#value').value">Save</button><output>Initial</output><script>
window.sourceBooted=true;document.querySelector('#value').value='seeded by real JS';document.querySelector('[type=checkbox]').checked=true;document.querySelector('textarea').value='real note';document.querySelector('select').selectedIndex=1;document.styleSheets[1].insertRule('output{color:rgb(21,91,33)}');
const bytes=Uint8Array.from(atob('${image}'),c=>c.charCodeAt(0));document.querySelector('#photo').src=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));window.fetch=()=>Promise.reject(Error('Mock API rejects unknown requests'));document.documentElement.dataset.reviewReady='true';
</script></body></html>`); return true;
  } }),
};
const app = await startCanvas({ config, port: 0, watchFiles: false });
const browser = await chromium.launch();
try {
  await app.firstBuild;
  const manifest = app.getManifest();
  assert.ok(manifest.screens.html.domUrl, "real HTML/CSS is available without a running app");
  assert.equal(manifest.screens.drawing.domUrl, undefined, "drawing surfaces keep their live source instead of a broken clone");
  const html = await (await fetch(manifest.screens.html.domUrl)).text();
  assert.ok(!html.includes("<script") && !html.includes("onclick") && !html.includes(app.address));
  assert.ok(html.includes("data:image/png;base64,"), "loaded source images and CSS resources remain in the full UI");
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.goto(app.address);
  const frozen = page.frameLocator('iframe[data-preview="html"]');
  await frozen.getByRole("heading", { name: "Real source UI" }).waitFor();
  assert.equal(await frozen.getByLabel("Value").inputValue(), "seeded by real JS");
  assert.equal(await frozen.locator("textarea").inputValue(), "real note");
  assert.equal(await frozen.locator("select").inputValue(), "Two");
  assert.equal(await frozen.locator('[type="checkbox"]').isChecked(), true);
  assert.equal(await frozen.locator("h1").evaluate(el => getComputedStyle(el).color), "rgb(31, 91, 106)");
  assert.equal(await frozen.locator("output").evaluate(el => getComputedStyle(el).color), "rgb(21, 91, 33)");
  assert.equal(await frozen.locator("#photo").evaluate(el => el.complete && el.naturalWidth > 0), true);
  assert.equal(await frozen.locator("html").evaluate(() => window.sourceBooted), undefined, "overview does not execute source app scripts");
  assert.equal(await frozen.locator("svg rect").count(), 1, "vectors remain real DOM, not a raster capture");
  await page.getByRole("button", { name: "▶ 操作 App", exact: true }).click();
  const live = page.frameLocator('iframe[data-screen="html"]');
  await live.getByLabel("Value").fill("actual source interaction");
  await live.getByRole("button", { name: "Save", exact: true }).click();
  assert.equal(await live.locator("output").innerText(), "actual source interaction");
  console.log("PASS: real HTML/CSS overview, JS-generated values, CSSOM styles, vectors, CSS/blob images, script-free isolation, live drawing fallback and original app interactions.");
} finally { await browser.close(); await app.close(); }
