import assert from "node:assert/strict";
import { chromium, webkit } from "./locale-browser.mjs";
import { startCanvas } from "../lib/server.mjs";

// The first assertion must fail if the one-click audience entry point is removed.
// Real controls below prove pacing, pause, continuing state, fresh queues and errors.
const config = {
  title: "Presentation proof", groups: [{ id: "app" }],
  catalog: ["home", "saved", "fresh", "case"].map(id => ({ id, title: id, group: "app" })),
  journeys: [
    { id: "save", title: "Edit and save", entry: "home", steps: [
      { title: "Write a draft", screen: "home", actions: [
        { type: "expect", selector: "input", value: "" },
        { type: "fill", selector: "input", value: "Demo draft" },
        { type: "expect", selector: "input", value: "Demo draft" },
      ] },
      { title: "Save the same draft", screen: "saved", actions: [
        { type: "click", selector: "#save" },
        { type: "expect", selector: "output", text: "Demo draft" },
      ] },
    ] },
    { id: "fresh", title: "A fresh flow", entry: "fresh", steps: [
      { title: "Fresh fixtures", screen: "fresh", actions: [
        { type: "expect", selector: "input", value: "" },
        { type: "expect", selector: "output", text: "Initial" },
      ] },
    ] },
    { id: "case", kind: "case", title: "Independent case", entry: "case", steps: [
      { title: "A standalone condition", screen: "case", actions: [{ type: "expect", selector: "h1", text: "case" }] },
    ] },
    { id: "broken", kind: "case", title: "Failed demo", entry: "home", steps: [
      { title: "Missing target", screen: "saved", actions: [{ type: "expect", selector: "#missing-demo-target", timeout: 150 }] },
    ] },
    { id: "navigation", kind: "case", title: "Navigation and dialog", entry: "home", steps: [
      { title: "Follow a real page link", screen: "fresh", actions: [
        { type: "fill", selector: "input", value: "Across pages" },
        { type: "click", selector: "#next" },
        { type: "expect", selector: "h1", text: "fresh" },
        { type: "expect", selector: "input", value: "Across pages" },
      ] },
      { title: "Open a native dialog", screen: "fresh", actions: [
        { type: "click", selector: "#open-dialog" },
        { type: "fill", selector: "#dialog-note", value: "Inside a dialog" },
        { type: "expect", selector: "dialog[open]" },
      ] },
    ] },
  ],
  preview: async ({ canvasOrigin }) => ({
    url: screen => `${canvasOrigin}/frame?id=${screen.id}`,
    handle(req, res, url) {
      if (url.pathname !== "/frame") return false;
      res.setHeader("Content-Type", "text/html");
      res.end(`<!doctype html><html data-review-ready="true"><head></head><body>
        <h1>${url.searchParams.get("id")}</h1><label>Draft <input oninput="localStorage.setItem('draft',this.value)"></label>
        <button id="save" onclick="document.querySelector('output').textContent=document.querySelector('input').value">Save</button>
        <output>Initial</output><a id="next" href="/frame?id=fresh" onclick="localStorage.setItem('navigations',String(Number(localStorage.getItem('navigations')||0)+1))">Next page</a>
        <button id="open-dialog" onclick="document.querySelector('dialog').showModal()">Open dialog</button>
        <dialog><label>Message <input id="dialog-note"></label></dialog>
        <script>document.querySelector('input').value=localStorage.getItem('draft')||'';</script></body></html>`);
      return true;
    },
  }),
};
const app = await startCanvas({ config, port: 0, watchFiles: false });
try {
  await app.firstBuild;
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1194, height: 834 }, hasTouch: engine === webkit });
      await page.goto(app.address);
      await page.locator('.review-workspace[data-live-ready="true"][data-camera-ready="true"]').waitFor();
      await page.getByLabel("播放流程").selectOption("__flows__");
      await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
      await page.locator(".react-flow__controls-zoomin").click();
      await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
      const priorCamera = await page.locator(".react-flow__viewport").getAttribute("style");
      const start = page.getByRole("button", { name: "自動播放 Demo", exact: true });
      assert.equal(await start.count(), 1, "one visible click starts the demo without opening a picker");
      await start.click();
      const demo = page.getByRole("region", { name: "Demo 播放" });
      const finishDemo = async () => {
        await page.waitForFunction(() => ["complete", "error"].includes(document.querySelector(".demo-player")?.dataset.status));
        assert.equal(await demo.getAttribute("data-status"), "complete", await demo.innerText());
      };
      await demo.waitFor();
      assert.equal(await page.locator(".workspace-dock").isVisible(), false);
      assert.equal(await page.getByRole("complementary", { name: "頁面導航" }).isVisible(), false);
      assert.equal(await page.getByRole("complementary", { name: "流程與資料" }).isVisible(), false);
      const live = page.frameLocator('iframe[data-screen="journey"]');
      await live.locator("[data-canvas-demo-pointer]").waitFor();
      assert.equal(await page.locator(".screen-frame.is-selected").isVisible(), false, "editing cards and connections must not compete with the presentation");
      assert.equal(await page.locator(".react-flow__edge-text").first().isVisible(), false, "graph captions stay out of the audience view");
      await demo.getByRole("button", { name: "暫停 Demo", exact: true }).click();
      await page.locator('.demo-player[data-status="paused"]').waitFor();
      assert.equal(await live.locator("output").innerText(), "Initial", "pause stops before the next real action");
      assert.equal(await live.locator("input").first().inputValue(), "Demo draft", "the in-flight action finishes once");
      await demo.getByLabel("Demo 播放速度").selectOption("0");
      await demo.getByRole("button", { name: "繼續 Demo", exact: true }).click();
      await finishDemo();
      assert.equal(await demo.getAttribute("data-finished"), "2", "the selected flows-only playlist excludes standalone conditions");
      assert.equal(await live.locator("h1").innerText(), "fresh", "the next flow gets its own fixture");
      assert.equal(await demo.getByRole("progressbar").getAttribute("aria-valuenow"), "100");
      await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
      const stage = await page.locator(".flow-stage").boundingBox(), frame = await page.locator('iframe[data-screen="journey"]').boundingBox();
      assert.ok(frame.y >= stage.y - 1 && frame.y + frame.height <= stage.y + stage.height + 1, "the audience can see the whole native viewport above the controls");
      await demo.getByRole("button", { name: "退出 Demo", exact: true }).click();
      await demo.waitFor({ state: "hidden" });
      await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
      assert.equal(await page.getByRole("complementary", { name: "頁面導航" }).isVisible(), true);
      assert.equal(await page.getByLabel("播放流程").inputValue(), "__flows__", "exit restores the previous browsing scope");
      assert.equal(await page.locator('iframe[data-screen="journey"]').count(), 0);
      await page.waitForFunction(expected => document.querySelector(".react-flow__viewport")?.getAttribute("style") === expected, priorCamera);
      assert.equal(await page.locator(".react-flow__viewport").getAttribute("style"), priorCamera, "exit restores the browsing camera as well as panel preferences");

      await page.getByLabel("播放流程").selectOption("save");
      await start.click();
      await finishDemo();
      assert.equal(await demo.getAttribute("data-finished"), "1", "an explicitly selected journey is honored");
      assert.equal(await live.locator("output").innerText(), "Demo draft", "a continuing app performs the actual save");
      await demo.getByRole("button", { name: "重播 Demo", exact: true }).click();
      await finishDemo();
      assert.equal(await live.locator("output").innerText(), "Demo draft", "replay resets fixtures before the first assertion");
      await live.locator("input").first().focus();
      await page.keyboard.press("Escape");
      await demo.waitFor({ state: "hidden" });
      assert.equal(await page.getByLabel("播放流程").inputValue(), "save");

      await page.getByLabel("播放流程").selectOption("broken");
      await start.click();
      await page.locator('.demo-player[data-status="error"]').waitFor();
      assert.match(await demo.getByRole("alert").innerText(), /missing-demo-target/);
      assert.equal(await demo.getAttribute("data-step"), "0", "an unconfirmed destination is never counted");
      await demo.getByRole("button", { name: "退出 Demo", exact: true }).click();

      await page.getByLabel("播放流程").selectOption("navigation");
      await start.click();
      await finishDemo();
      assert.equal(await live.locator("input").first().inputValue(), "Across pages", "full-document navigation keeps the continuing session");
      assert.equal(await live.locator("html").evaluate(() => localStorage.getItem("navigations")), "1", "navigation must not repeat the click");
      await live.locator("#dialog-note").focus();
      await page.keyboard.press("Escape");
      await demo.waitFor({ state: "hidden" });

      await page.getByLabel("播放流程").selectOption("save");
      // Slow playback leaves a cancellable visual cue active when exiting.
      await page.getByLabel("播放速度").selectOption("1800");
      await start.click();
      await live.locator("[data-canvas-demo-pointer]").waitFor();
      await demo.getByRole("button", { name: "退出 Demo", exact: true }).click();
      await page.getByRole("button", { name: "單步", exact: true }).click();
      await page.locator('.journey-panel[data-status="paused"][data-step="1"]').waitFor();
      assert.equal(await live.locator("output").innerText(), "Initial", "exiting a demo cannot leak delayed actions into a new manual run");
      await page.getByRole("button", { name: "停止", exact: true }).click();

      await page.setViewportSize({ width: 390, height: 844 });
      await start.click();
      await demo.waitFor();
      const controls = await demo.boundingBox();
      assert.ok(controls.x >= 0 && controls.x + controls.width <= 391, "portrait controls fit without horizontal overflow");
      assert.equal(await demo.getByRole("button", { name: "退出 Demo", exact: true }).isVisible(), true);
      await demo.getByRole("button", { name: "退出 Demo", exact: true }).click();
      await page.close();
      console.log(`PASS: ${engine.name()} one-click demo, action cues, pause, queue state, selected flow, replay, Escape, failure, cancellation and portrait layout.`);
    } finally { await browser.close(); }
  }
  const empty = await startCanvas({ config: { ...config, journeys: [] }, port: 0, watchFiles: false });
  const browser = await chromium.launch({ headless: true });
  try {
    await empty.firstBuild;
    const page = await browser.newPage();
    await page.goto(empty.address);
    assert.equal(await page.getByRole("button", { name: "自動播放 Demo", exact: true }).isDisabled(), true, "no invented interactions when the project has no authored journeys");
  } finally { await browser.close(); await empty.close(); }
  const cases = await startCanvas({ config: { ...config, journeys: [config.journeys[2]] }, port: 0, watchFiles: false });
  const caseBrowser = await chromium.launch({ headless: true });
  try {
    await cases.firstBuild;
    const page = await caseBrowser.newPage();
    await page.goto(cases.address);
    await page.locator('.review-workspace[data-live-ready="true"]').waitFor();
    // An explicitly chosen empty queue must still have a usable one-click path.
    await page.getByLabel("播放流程").selectOption("__flows__");
    await page.getByRole("button", { name: "自動播放 Demo", exact: true }).click();
    await page.locator('.demo-player[data-status="complete"]').waitFor();
    assert.match(await page.getByRole("region", { name: "Demo 播放" }).innerText(), /獨立情境/);
  } finally { await caseBrowser.close(); await cases.close(); }
} finally { await app.close(); }
