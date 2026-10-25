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
  console.log("PASS flow outcome telemetry: real failed and completed playback each emit once; fixed safe code only, no raw error/source/screen contents.");
} finally { await browser?.close(); await app.close(); await rm(home, { recursive: true, force: true }); }
