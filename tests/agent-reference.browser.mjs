import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { startCanvas } from "../lib/server.mjs";

const app = await startCanvas({ port: 0, watchFiles: false, config: {
  title: "Synthetic product", groups: [{ id: "app" }],
  catalog: [{ id: "checkout", title: "Checkout", group: "app", source: "src/Checkout.jsx" }, { id: "settings", title: "Settings", group: "app", source: "src/Settings.jsx" }],
  preview: async ({ canvasOrigin }) => ({
    url: () => `${canvasOrigin}/fixture`,
    handle(_request, response, url) {
      if (url.pathname !== "/fixture") return false;
      response.setHeader("Content-Type", "text/html");
      response.end('<!doctype html><html data-review-ready="true"><head><style>body{font:20px sans-serif;margin:32px}button{padding:20px}</style></head><body><h1>Checkout</h1><button id="save" data-clicks="0" data-capture-clicks="0" onclick="this.dataset.clicks=String(Number(this.dataset.clicks)+1)">Save order</button><input type="password" value="fixture-secret"><p>Point to the button to request a change.</p><script>window.addEventListener("click",()=>{const b=document.getElementById("save");b.dataset.captureClicks=String(Number(b.dataset.captureClicks)+1)},true)</script></body></html>');
      return true;
    },
  }),
} });
let browser;
try {
  await app.firstBuild;
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage(), errors = [];
  if (process.env.APP_CANVAS_REFERENCE_CPU_RATE) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.APP_CANVAS_REFERENCE_CPU_RATE) });
  }
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${app.address}?lang=en`);
  await page.locator('.review-workspace[data-live-ready="true"]').waitFor();
  await page.getByLabel("Search screens").fill("checkout");
  await page.locator('[title="checkout"]').click();
  const readiness = await page.evaluate(() => ({
    cameraReady: document.querySelector(".review-workspace").dataset.cameraReady === "true",
    disabled: [...document.querySelectorAll("button")].find(button => button.textContent === "Point to an element").disabled,
  }));
  assert.ok(readiness.cameraReady || readiness.disabled, "pointing is unavailable while its target is moving");
  await page.getByRole("button", { name: "Point to an element", exact: true }).click();
  const frame = page.frameLocator('iframe[data-screen="checkout"]');
  await frame.locator("html[data-agent-canvas-picking]").waitFor();
  assert.equal(await page.locator(".review-workspace").getAttribute("data-camera-ready"), "true", "entering point mode must not launch another camera animation");
  const point = await frame.locator("#save").boundingBox();
  await page.mouse.click(point.x + point.width / 2, point.y + point.height / 2);
  await page.getByText("Selected element:", { exact: false }).waitFor();
  assert.equal(await frame.locator("#save").getAttribute("data-clicks"), "0", "pointing must not run the target button's action");
  assert.equal(await frame.locator("#save").getAttribute("data-capture-clicks"), "0", "pointing must stop application window capture listeners too");
  await page.getByLabel("What should change?", { exact: true }).fill("Make the save button full width.");
  await page.getByRole("button", { name: "Copy change request", exact: true }).click();
  await page.getByText("Copied. Paste into Claude Code, Codex, or your coding agent.", { exact: true }).waitFor();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(clipboard, /Make the save button full width/);
  assert.match(clipboard, /src\/Checkout.jsx/);
  assert.match(clipboard, /button#save/);
  assert.doesNotMatch(clipboard, /fixture-secret/);
  await page.getByRole("button", { name: "Panels", exact: true }).click();
  assert.equal(await page.locator(".release-preview").count(), 0, "pointing must not retain a new app interaction preview");
  await page.getByRole("button", { name: "Panels", exact: true }).click();
  // A stale document cannot replace the confirmed target through the bridge.
  await frame.locator("body").evaluate(() => parent.postMessage({ channel: "app-canvas", type: "picked", documentId: "stale-document", element: { tag: "a", selector: "#stale" } }, location.origin));
  assert.doesNotMatch(await page.getByLabel("Agent change request", { exact: true }).inputValue(), /#stale/);
  await page.getByRole("button", { name: "Point to an element", exact: true }).click();
  await frame.locator("html[data-agent-canvas-picking]").waitFor();
  await page.getByRole("button", { name: "Fit all", exact: true }).click();
  await page.getByRole("button", { name: "Point to an element", exact: true }).waitFor();
  await frame.locator("html[data-agent-canvas-picking]").waitFor({ state: "detached" });
  assert.equal(await page.locator(".review-workspace").getAttribute("data-mode"), "browse", "camera motion cancels pointing and app interaction together");
  assert.equal(await page.locator('iframe[data-screen="checkout"]').evaluate(element => getComputedStyle(element).pointerEvents), "none");
  await page.getByRole("button", { name: "Zoom to screen", exact: false }).click();
  await page.getByRole("button", { name: "Point to an element", exact: true }).click();
  await frame.locator("html[data-agent-canvas-picking]").waitFor();
  await frame.locator("body").press("Escape");
  await page.getByRole("button", { name: "Point to an element", exact: true }).waitFor();
  await page.getByRole("button", { name: "▶ Interact with screen", exact: true }).click();
  await frame.locator("#save").click();
  assert.equal(await frame.locator("#save").getAttribute("data-clicks"), "1", "normal interaction remains available after canceling point mode");
  assert.equal(await frame.locator("#save").getAttribute("data-capture-clicks"), "1", "application window capture listeners work during normal interaction");
  await mkdir(".artifacts/agent-reference", { recursive: true });
  await page.screenshot({ path: ".artifacts/agent-reference/desktop.png" });
  await page.getByLabel("Search screens").fill("settings");
  await page.locator('[title="settings"]').click();
  assert.equal(await page.getByLabel("What should change?", { exact: true }).inputValue(), "", "another screen must not inherit the previous target's change request");
  const denied = await context.newPage();
  await denied.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw Error("denied"); } } }));
  await denied.goto(`${app.address}?lang=en`);
  await denied.locator('.review-workspace[data-live-ready="true"]').waitFor();
  await denied.getByLabel("Search screens").fill("checkout");
  await denied.locator('[title="checkout"]').click();
  await denied.getByLabel("What should change?", { exact: true }).fill("Increase spacing.");
  await denied.getByRole("button", { name: "Copy change request", exact: true }).click();
  await denied.getByRole("alert").filter({ hasText: "Clipboard unavailable" }).waitFor();
  assert.ok(await denied.getByLabel("Agent change request", { exact: true }).isVisible());
  assert.match(await denied.getByLabel("Agent change request", { exact: true }).inputValue(), /Increase spacing/);
  assert.equal(await denied.getByText("Copied. Paste into Claude Code, Codex, or your coding agent.", { exact: true }).count(), 0);
  await denied.setViewportSize({ width: 390, height: 844 });
  assert.ok(await denied.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await denied.getByLabel("Agent change request", { exact: true }).scrollIntoViewIfNeeded();
  await denied.screenshot({ path: ".artifacts/agent-reference/phone.png" });
  const touchContext = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
  await touchContext.addInitScript(() => {
    window.__referenceEvents = [];
    for (const type of ["pointerdown", "pointerup", "pointercancel", "touchstart", "touchend", "click"]) window.addEventListener(type, event => window.__referenceEvents.push({ type, pointerType: event.pointerType, target: event.target?.id || event.target?.tagName }), true);
  });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(`${app.address}?lang=en`);
  await touchPage.locator('.review-workspace[data-live-ready="true"]').waitFor();
  await touchPage.getByLabel("Search screens").fill("checkout");
  await touchPage.locator('[title="checkout"]').click();
  await touchPage.getByRole("button", { name: "Point to an element", exact: true }).click();
  const touchFrame = touchPage.frameLocator('iframe[data-screen="checkout"]');
  await touchFrame.locator("html[data-agent-canvas-picking]").waitFor();
  await touchPage.locator('.review-workspace[data-camera-ready="true"]').waitFor();
  await touchFrame.locator("#save").tap();
  try { await touchPage.getByText("Selected element:", { exact: false }).waitFor({ timeout: 5000 }); }
  catch (error) { console.error("Touch picker evidence:", await touchFrame.locator("html").evaluate(el => ({ picking: el.hasAttribute("data-agent-canvas-picking"), events: window.__referenceEvents, url: location.href })), await touchPage.evaluate(() => ({ events: window.__referenceEvents, text: document.querySelector(".agent-reference")?.innerText, iframe: document.querySelector("iframe[data-screen]")?.getAttribute("src") }))); throw error; }
  assert.equal(await touchFrame.locator("#save").getAttribute("data-clicks"), "0", "touch pointing must not invoke application actions");
  assert.equal(await touchFrame.locator("#save").getAttribute("data-capture-clicks"), "0", "touch pointing must stop app window capture listeners");
  await touchContext.close();
  assert.deepEqual(errors, []);
  console.log("PASS agent reference: trusted element selection without action, actual clipboard request, source binding, stale-message rejection, Escape, normal interaction, denied clipboard fallback and phone overflow.");
} finally { await browser?.close(); await app.close(); }
