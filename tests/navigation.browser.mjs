import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startCanvas } from "../lib/server.mjs";
const config = {
  title: "Navigation proof", groups: [{ id: "one", title: "One" }, { id: "two", title: "Two" }],
  catalog: [{ id: "start", title: "Start", group: "one" }, { id: "next", title: "Next", group: "two" }],
  flows: [{ from: "start", to: "next", label: "Continue" }],
  preview: async ({ canvasOrigin }) => ({
    url: (s) => `${canvasOrigin}/frame?id=${s.id}`,
    handle(req, res, url) {
      if (url.pathname !== "/frame") return false;
      res.setHeader("Content-Type", "text/html");
      res.end(`<!doctype html><html data-review-ready="true"><head></head><body><h1>Real DOM</h1><label>Name<input id="name" oninput="localStorage.setItem('draft',this.value)"></label><button id="save" onclick="document.querySelector('output').textContent=document.querySelector('input').value">Save</button><a id="navigate" href="/frame?id=${url.searchParams.get("id")}&after=1">Navigate</a><output></output><script>document.querySelector('input').value=localStorage.getItem('draft')||''</script></body></html>`); return true;
    },
  }),
};
const app = await startCanvas({ config, port: 0, watchFiles: false });
const browser = await chromium.launch({ headless: true });
try {
  await app.firstBuild;
  const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
  await page.goto(app.address);
  await page.evaluate(() => { localStorage.setItem("outside-preview", "keep"); sessionStorage.setItem("outside-preview", "keep"); });
  await page.getByText("2 個畫面 · 已同步", { exact: true }).waitFor();
  const settled = () => page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
  const targetFits = async (id) => {
    await settled();
    const bounds = await page.locator(`[data-id="${id}"] .screen-frame`).boundingBox();
    const area = await page.locator(".flow-stage").boundingBox();
    assert.ok(bounds && bounds.width > 200 && bounds.x >= area.x && bounds.x + bounds.width <= area.x + area.width && bounds.y >= area.y, `destination must be visibly zoomed into the usable canvas: ${JSON.stringify({ bounds, area })}`);
    assert.equal(await page.locator(".inspector code").innerText(), id);
  };
  await page.getByRole("button", { name: "One", exact: false }).first().click();
  await page.locator('[title="start"]').click();
  await settled();
  const before = await page.locator(".react-flow__viewport").getAttribute("style");
  await page.locator(".inspector .flow-link").click();
  await targetFits("next");
  assert.equal(await page.locator(".inspector code").innerText(), "next");
  assert.notEqual(await page.locator(".react-flow__viewport").getAttribute("style"), before, "next flow must move the camera, including across a filtered group");
  await page.getByLabel("搜尋畫面").fill("start");
  await page.locator('[title="start"]').click();
  await page.getByRole("button", { name: "▶ 操作呢個畫面", exact: true }).click();
  await settled();
  const first = page.frameLocator('iframe[data-screen="start"]'), second = page.frameLocator('iframe[data-screen="next"]');
  await first.locator("#name").fill("draft survives filters");
  assert.equal(await second.locator("#name").inputValue(), "", "sibling fixture starts independently");
  await page.locator(".inspector .flow-link").click();
  await targetFits("next");
  assert.equal(await page.locator('[data-id="next"] .is-interactive').count(), 1, "next keeps in-canvas interaction enabled");
  await second.locator("#name").fill("independent second draft");
  await first.locator("html").evaluate(() => localStorage.clear());
  assert.equal(await second.locator("html").evaluate(() => localStorage.getItem("draft")), "independent second draft", "clear is frame-local");
  await page.locator(".inspector .flow-link").click();
  await targetFits("start");
  assert.equal(await first.locator("#name").inputValue(), "draft survives filters", "filter/navigation preserves the mounted DOM");
  await first.locator("#name").fill("survives document navigation");
  await first.locator("#navigate").click();
  await first.locator("#name").waitFor();
  assert.equal(await first.locator("#name").inputValue(), "survives document navigation");
  // A sibling cannot send commands to another preview, even at the same origin.
  await first.locator("html").evaluate(() => parent.document.querySelector('iframe[data-screen="next"]').contentWindow.postMessage({ channel: "app-canvas", type: "command", requestId: "wrong-source", action: { type: "fill", selector: "#name", value: "forged" } }, location.origin));
  await page.evaluate(() => window.postMessage({ channel: "app-canvas", type: "state", ready: false, error: "forged" }, location.origin));
  await page.getByRole("button", { name: "重設", exact: true }).click();
  await first.locator("#name").waitFor();
  await page.waitForFunction(() => document.querySelector('iframe[data-screen="start"]').contentDocument?.querySelector("#name")?.value === "");
  assert.equal(await second.locator("#name").inputValue(), "independent second draft");
  assert.equal(await page.locator('.review-workspace[data-live-ready="true"]').count(), 1);
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem("outside-preview"), sessionStorage.getItem("outside-preview")]), ["keep", "keep"], "native storage outside the preview stays untouched");
  // Edge labels are an additional navigation surface.
  await page.getByRole("button", { name: "全覽", exact: false }).click();
  await settled();
  await page.locator(".react-flow__edge-textwrapper").filter({ hasText: "Continue" }).click();
  await targetFits("next");
  console.log("PASS: flow links and graph edges select/zoom the destination across group/search filters; live drafts, per-frame storage, reset and message-source isolation.");
} finally { await browser.close(); await app.close(); }
