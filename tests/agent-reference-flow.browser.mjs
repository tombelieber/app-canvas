import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { startCanvas } from "../lib/server.mjs";
import { createTelemetry } from "../lib/telemetry.mjs";

const home = await mkdtemp(join(tmpdir(), "agent-flow-proof-")), sent = [];
const telemetry = await createTelemetry({ home, env: {}, version: "0.16.0", surface: "qualification", fetcher: async (_url, options) => { sent.push(JSON.parse(options.body)); return { ok: true }; } });
const app = await startCanvas({ port: 0, watchFiles: false, telemetry, config: {
  title: "Private fixture name", groups: [{ id: "app" }], catalog: [{ id: "private-fixture", title: "Private screen name", group: "app" }],
  journeys: [
    { id: "failure", title: "Controlled mismatch", entry: "private-fixture", steps: [{ title: "Mismatch", screen: "private-fixture", actions: [{ type: "expect", selector: "h1", text: "Does not exist", timeout: 50 }] }] },
    { id: "success", title: "Controlled success", entry: "private-fixture", steps: [{ title: "Match", screen: "private-fixture", actions: [{ type: "expect", selector: "h1", text: "Ready" }] }] },
  ],
  preview: async ({ canvasOrigin }) => ({ url: () => `${canvasOrigin}/fixture`, handle(_request, response, url) { if (url.pathname !== "/fixture") return false; response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html data-review-ready="true"><body><h1>Ready</h1></body></html>'); return true; } }),
} });
let browser;
try {
  await app.firstBuild;
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.goto(`${app.address}?lang=en`);
  await page.locator('.review-workspace[data-live-ready="true"]').waitFor();
  await page.getByLabel("Play flow", { exact: true }).selectOption("failure");
  const failure = page.waitForResponse(response => new URL(response.url()).pathname === "/telemetry" && response.request().postDataJSON()?.event === "flow_failed");
  await page.getByRole("button", { name: "▶ Play", exact: true }).click();
  await page.locator('.journey-panel[data-status="error"]').waitFor();
  await failure;
  const failed = sent.filter(event => event.event === "flow_failed");
  assert.equal(sent.filter(event => event.event === "flow_started").length, 1, "manual failed playback must record its actual start");
  assert.equal(failed.length, 1);
  assert.equal(failed[0].properties.error_code, "journey_failed");
  assert.equal(failed[0].properties.environment, "qualification");
  assert.doesNotMatch(JSON.stringify(failed), /Private|private-fixture|Does not exist|h1/);
  await page.getByLabel("Play flow", { exact: true }).selectOption("success");
  const complete = page.waitForResponse(response => new URL(response.url()).pathname === "/telemetry" && response.request().postDataJSON()?.event === "flow_completed");
  await page.getByRole("button", { name: "▶ Play", exact: true }).click();
  await complete;
  await page.locator('.journey-panel[data-status="complete"]').waitFor();
  assert.equal(sent.filter(event => event.event === "flow_failed").length, 1);
  assert.equal(sent.filter(event => event.event === "flow_completed").length, 1);
  assert.equal(sent.filter(event => event.event === "flow_started").length, 2, "manual success and failure each record one start");
  const demoComplete = page.waitForResponse(response => new URL(response.url()).pathname === "/telemetry" && response.request().postDataJSON()?.event === "flow_completed");
  await page.getByRole("button", { name: "Start Demo", exact: true }).click();
  await demoComplete;
  await page.locator('.demo-player[data-status="complete"]').waitFor();
  assert.equal(sent.filter(event => event.event === "flow_started").length, 3, "Demo records exactly one real start without a second click beacon");
  assert.equal(sent.filter(event => event.event === "flow_completed").length, 2);
  await page.getByRole("button", { name: "Exit demo", exact: true }).click();

  // The app can finish a fast flow before its asynchronous analytics config
  // arrives. Starting and terminal effects must replay once readiness changes.
  const delayed = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  let releaseConfig;
  const configGate = new Promise(resolve => { releaseConfig = resolve; });
  await delayed.route("**/telemetry.json", async route => { await configGate; await route.continue(); });
  await delayed.goto(`${app.address}?lang=en`);
  await delayed.locator('.review-workspace[data-live-ready="true"]').waitFor();
  await delayed.getByLabel("Play flow", { exact: true }).selectOption("success");
  await delayed.getByRole("button", { name: "▶ Play", exact: true }).click();
  await delayed.locator('.journey-panel[data-status="complete"]').waitFor();
  assert.equal(sent.filter(event => event.event === "flow_started").length, 3, "unavailable config does not prematurely consume start dedup");
  const delayedStarted = delayed.waitForResponse(response => new URL(response.url()).pathname === "/telemetry" && response.request().postDataJSON()?.event === "flow_started");
  const delayedComplete = delayed.waitForResponse(response => new URL(response.url()).pathname === "/telemetry" && response.request().postDataJSON()?.event === "flow_completed");
  releaseConfig();
  await Promise.all([delayedStarted, delayedComplete]);
  assert.equal(sent.filter(event => event.event === "flow_started").length, 4);
  assert.equal(sent.filter(event => event.event === "flow_completed").length, 3);
  assert.equal(sent.filter(event => event.event === "flow_failed").length, 1);
  assert.doesNotMatch(JSON.stringify(sent.filter(event => event.event.startsWith("flow_"))), /Private|private-fixture|Does not exist|h1/);
  console.log("PASS flow lifecycle telemetry: manual failure+success, Demo and pre-config completion each emit one real start/outcome; fixed safe failure code, no raw UI/error/source data.");
} finally { await browser?.close(); await app.close(); await rm(home, { recursive: true, force: true }); }
