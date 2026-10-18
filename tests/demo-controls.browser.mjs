import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { startCanvas } from "../lib/server.mjs";
import { withNativeOverview } from "./native-overview-fixture.mjs";

let holdFixture = false;
const config = {
  title: "Player controls", groups: [{ id: "app" }],
  pages: [{ id: "record", title: "Record" }, { id: "settings", title: "Settings" }, { id: "reference", title: "Reference" }],
  catalog: [
    { id: "home", pageId: "record" }, { id: "saved", pageId: "record" },
    { id: "detail", pageId: "settings" }, { id: "quiet", pageId: "reference" },
  ].map(s => ({ ...s, title: s.id, group: "app" })),
  journeys: [
    { id: "draft", title: "Write and save", entry: "home", steps: [
      { title: "Write draft", screen: "home", actions: [{ type: "expect", selector: "input", value: "" }, { type: "fill", selector: "input", value: "retained" }, { type: "expect", selector: "input", value: "retained" }] },
      { title: "Save draft", screen: "saved", actions: [{ type: "click", selector: "#save" }, { type: "expect", selector: "output", text: "retained" }] },
    ] },
    { id: "cross", title: "Cross-page flow", entry: "home", steps: [
      { title: "Open detail", screen: "detail", actions: [{ type: "expect", selector: "input", value: "" }, { type: "click", selector: "#next" }, { type: "expect", selector: "h1", text: "detail" }] },
    ] },
    { id: "settings", title: "Change settings", entry: "detail", steps: [
      { title: "Update settings", screen: "detail", actions: [{ type: "click", selector: "#update" }, { type: "expect", selector: "output", text: "Updated" }] },
    ] },
    { id: "quiet", title: "Reference case", kind: "case", entry: "quiet", steps: [
      { title: "Read reference", screen: "quiet", actions: [{ type: "expect", selector: "h1", text: "quiet" }] },
    ] },
  ],
  preview: async ({ canvasOrigin }) => ({ url: s => `${canvasOrigin}/frame?id=${s.id}`, handle(req, res, url) {
    if (url.pathname !== "/frame") return false;
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html><html data-review-ready="${!holdFixture}"><head></head><body><h1>${url.searchParams.get("id")}</h1>
      <input oninput="localStorage.setItem('draft',this.value)"><button id="save" onclick="document.querySelector('output').textContent=document.querySelector('input').value">Save</button>
      <a id="next" href="/frame?id=detail">Next</a><button id="update" onclick="document.querySelector('output').textContent='Updated'">Update</button><output>Initial</output>
      <script>document.querySelector('input').value=localStorage.getItem('draft')||'';</script></body></html>`);
    return true;
  } }),
};
const app = await startCanvas({ config: await withNativeOverview(config), port: 0, watchFiles: false });
try {
  await app.firstBuild;
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1194, height: 834 }, hasTouch: engine === webkit });
      const errors = []; page.on("pageerror", error => errors.push(error.message));
      await page.goto(app.address);
      await page.locator('.review-workspace[data-live-ready="true"][data-camera-ready="true"]').waitFor();
      if (process.env.APP_CANVAS_TEST_NATIVE_ATLAS === "1") {
        await page.locator('.native-overview').waitFor();
        const supported = await page.locator('.native-overview canvas').evaluate(c => !!c.getContext('webgl2', { alpha: true, antialias: false }));
        await page.locator(`.native-overview[data-status="${supported ? 'ready' : 'fallback'}"]`).waitFor();
        console.log(`Native atlas ${engine.name()}: ${supported ? 'GPU active' : 'original renderer fallback'}`);
      }
      // The new scope control must be available before playback, including pages.
      assert.equal(await page.getByLabel("播放流程").locator('option[value="__page__:settings"]').count(), 1, "a page is a first-class demo scope");
      await page.getByRole("button", { name: "自動播放 Demo", exact: true }).click();
      const demo = page.getByRole("region", { name: "Demo 播放" });
      const live = page.frameLocator('iframe[data-screen="journey"]');
      const scope = demo.getByLabel("Demo 播放範圍"), speed = demo.getByLabel("Demo 播放速度");
      const finish = async () => {
        await page.waitForFunction(() => ["complete", "error"].includes(document.querySelector(".demo-player")?.dataset.status));
        assert.equal(await demo.getAttribute("data-status"), "complete", await demo.innerText());
      };
      await speed.selectOption("0"); await finish();
      assert.equal(await demo.getAttribute("data-finished"), "4", "all demos include interaction flows and standalone cases");
      assert.equal(await live.locator("h1").innerText(), "quiet");
      await scope.selectOption("__page__:settings"); await finish();
      assert.equal(await demo.getAttribute("data-finished"), "2", "page scope includes the complete cross-page journey and its local flow");

      await speed.selectOption("1800");
      await scope.selectOption("draft");
      await live.locator("[data-canvas-demo-pointer]").waitFor();
      await demo.getByRole("button", { name: "暫停 Demo", exact: true }).click();
      await page.locator('.demo-player[data-status="paused"]').waitFor();
      const elapsed = demo.getByLabel("Demo 已播放時間");
      assert.notEqual(await elapsed.innerText(), "00:00", "the clock records actual active playback");
      const pausedTime = await elapsed.innerText();
      await page.waitForTimeout(1100);
      assert.equal(await elapsed.innerText(), pausedTime, "paused time must not keep ticking");
      const remaining = demo.getByLabel("Demo 預計剩餘時間");
      const slower = Number((await remaining.getAttribute("datetime")).slice(2, -1));
      await speed.selectOption("225");
      const faster = Number((await remaining.getAttribute("datetime")).slice(2, -1));
      assert.ok(faster < slower, "4x speeds up the presentation pacing and updates its estimate");
      await demo.getByRole("button", { name: "下一步", exact: true }).click();
      await page.locator('.demo-player[data-status="paused"][data-step="1"]').waitFor();
      assert.equal(await live.locator("input").inputValue(), "retained");
      assert.equal(await live.locator("output").innerText(), "Initial", "next step executes prerequisites without prematurely saving");
      assert.match(await demo.getByLabel("下一個動作").innerText(), /Save draft/);

      const timeline = demo.getByRole("slider", { name: "Demo 時間軸" });
      await timeline.focus(); await page.keyboard.press("Home");
      await page.locator('.demo-player[data-status="paused"][data-step="0"]').waitFor();
      assert.equal(await live.locator("input").inputValue(), "", "backwards seeking recreates this flow's clean fixture");
      await timeline.focus(); await page.keyboard.press("ArrowRight");
      await page.locator('.demo-player[data-status="paused"][data-step="1"]').waitFor();
      assert.equal(await live.locator("input").inputValue(), "retained", "seeking reconstructs required app state before landing");
      assert.equal(await live.locator("output").innerText(), "Initial");
      const source = await page.locator('iframe[data-screen="journey"]').getAttribute("src");
      const track = await timeline.boundingBox();
      await page.mouse.move(track.x + track.width / 2, track.y + track.height / 2);
      await page.mouse.down();
      await page.mouse.move(track.x + 3, track.y + track.height / 2, { steps: 6 });
      assert.equal(await page.locator('iframe[data-screen="journey"]').getAttribute("src"), source, "scrubbing previews a position without restarting on every pointer movement");
      await page.mouse.up();
      await page.locator('.demo-player[data-status="paused"][data-step="0"]').waitFor();
      assert.equal(await live.locator("input").inputValue(), "", "releasing the timeline commits its selected position");
      await demo.getByRole("button", { name: "退出 Demo", exact: true }).click();

      await page.getByLabel("播放流程").selectOption("__all__");
      // Keep the first real app in loading until Pause has landed. Otherwise
      // fast playback can finish it before WebKit delivers the pause click,
      // and a later queue=1 wait can match that previous paused state.
      holdFixture = true;
      await page.getByRole("button", { name: "自動播放 Demo", exact: true }).click();
      await live.locator('html[data-review-ready="false"]').waitFor({ state: "attached" });
      await demo.getByRole("button", { name: "暫停 Demo", exact: true }).click();
      await page.locator('.demo-player[data-status="paused"][data-queue="0"][data-finished="0"]').waitFor();
      holdFixture = false;
      await demo.getByRole("button", { name: "下一個 Demo", exact: true }).click();
      await page.locator('.demo-player[data-status="paused"][data-queue="1"][data-skipped="1"][data-finished="0"]').waitFor();
      assert.equal(await demo.getAttribute("data-skipped"), "1", "skipping a demo is reported separately from completion");
      assert.equal(await demo.getAttribute("data-finished"), "0");
      assert.equal(await live.locator("input").inputValue(), "", "next demo receives a fresh fixture");
      await demo.getByRole("button", { name: "下一步", exact: true }).click();
      await page.locator('.demo-player[data-status="paused"][data-step="1"]').waitFor();
      assert.equal(await live.locator("h1").innerText(), "detail", "fast forward still follows real page navigation");
      await speed.selectOption("0");
      await demo.getByRole("button", { name: "繼續 Demo", exact: true }).click(); await finish();
      assert.equal(await demo.getAttribute("data-finished"), "3");
      assert.equal(await demo.getAttribute("data-skipped"), "1");
      assert.match(await demo.innerText(), /略過 1/);
      await demo.getByRole("button", { name: "上一個 Demo", exact: true }).click();
      await page.locator('.demo-player[data-status="paused"][data-queue="2"]').waitFor();
      assert.equal(await live.locator("h1").innerText(), "detail");
      await demo.getByRole("button", { name: "退出 Demo", exact: true }).click();

      await page.getByLabel("頁面範圍").selectOption("settings");
      await page.getByRole("button", { name: "自動播放 Demo", exact: true }).click(); await finish();
      assert.equal(await scope.inputValue(), "__page__:settings", "one-click playback follows the currently browsed page");
      assert.equal(await demo.getAttribute("data-finished"), "2");
      await page.setViewportSize({ width: 390, height: 844 });
      const bounds = await demo.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391);
      assert.equal(await timeline.isVisible(), true);
      assert.ok((await timeline.boundingBox()).height >= 44, "the timeline has a full touch target");
      assert.ok(await scope.evaluate(element => parseFloat(getComputedStyle(element).fontSize)) >= 16, "portrait selectors avoid focus zoom");
      assert.equal(await demo.getByRole("button", { name: "退出 Demo", exact: true }).isVisible(), true);
      await demo.getByRole("button", { name: "退出 Demo", exact: true }).click();
      assert.deepEqual(errors, []);
      console.log(`PASS ${engine.name()}: whole-app/page/flow playlists, clock and rates, stateful step seeking, next/previous demo, truthful skips and portrait controls.`);
    } finally { await browser.close(); }
  }
} finally { await app.close(); }

await import("./demo-playlist.browser.mjs");
