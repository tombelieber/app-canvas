import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startImportSite } from "./fixtures/import-site.mjs";
const root = await mkdtemp(join(tmpdir(), "app-canvas-import-e2e-")), site = await startImportSite();
const cli = process.env.APP_CANVAS_TEST_CLI || fileURLToPath(new URL("../bin/app-canvas.mjs", import.meta.url));
let child, browser;
const start = args => new Promise((resolve, reject) => {
  child = spawn(process.execPath, [cli, ...args, "--port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "", errors = ""; const timer = setTimeout(() => reject(Error(`CLI did not open App Canvas: ${errors}`)), 20000);
  child.stdout.on("data", data => { output += data; const address = output.match(/App Canvas import: (http:\/\/127\.0\.0\.1:\d+)/)?.[1]; if (address) { clearTimeout(timer); resolve(address); } });
  child.stderr.on("data", data => errors += data);
  child.once("exit", code => { clearTimeout(timer); if (!output.includes("App Canvas import:")) reject(Error(`CLI import/open must start App Canvas (${code}): ${errors}`)); });
});
const stop = () => new Promise(resolve => { if (!child || child.exitCode !== null) return resolve(); child.once("exit", resolve); child.kill("SIGTERM"); });
try {
  const directory = join(root, "project"), address = await start(["import", `${site.url}/calendar`, "--out", directory, "--headless", "--no-record"]);
  browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await page.goto(address); await page.getByText("Content calendar", { exact: true }).first().waitFor();
  await page.frameLocator("iframe[data-overview]").locator('[data-visible="true"][data-ready="true"]').waitFor({ state: "visible", timeout: 5000 });
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator('iframe[data-import-editor][data-ready="true"]').waitFor();
  await page.getByRole("button", { name: "Content calendar", exact: true }).last().click();
  await page.getByLabel("Text content", { exact: true }).fill("Edited landscape");
  await page.getByRole("button", { name: "Apply text", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Saved", { exact: true }).waitFor();
  const token = await page.evaluate(() => window.__unusedToken);
  assert.equal(token, undefined, "no ambient token global");
  const denied = await fetch(`${address}/api/import/save`, { method: "POST", headers: { Origin: "https://example.test", "Content-Type": "application/json" }, body: "{}" }); assert.equal(denied.status, 403);
  const project = await (await fetch(`${address}/project.json`)).json();
  for (const endpoint of ["save", "asset", "capture", "more"]) {
    for (const headers of [{}, { Origin: address, "X-App-Canvas-Token": "wrong" }, { Origin: "https://example.test", "X-App-Canvas-Token": project.sessionToken }]) {
      const response = await fetch(`${address}/api/import/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: "{}" });
      assert.equal(response.status, 403, `${endpoint} rejects unauthorized writers`);
    }
  }
  const authorized = { Origin: address, "Content-Type": "application/json", "X-App-Canvas-Token": project.sessionToken };
  const second = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await second.goto(address); await second.getByRole("button", { name: "Edit", exact: true }).click();
  await second.locator('iframe[data-import-editor][data-ready="true"]').waitFor();
  await second.getByRole("button", { name: "Edited landscape", exact: true }).click();
  await second.getByLabel("Text content", { exact: true }).fill("Unsaved second window");
  await second.getByRole("button", { name: "Apply text", exact: true }).click();
  await second.frameLocator("iframe[data-import-editor]").getByText("Unsaved second window", { exact: true }).waitFor();
  await second.getByText("Unsaved changes", { exact: true }).waitFor();
  assert.equal((await fetch(`${address}/api/import/capture`, { method: "POST", headers: authorized, body: "{}" })).status, 200);
  await second.getByRole("button", { name: "Save", exact: true }).click();
  await second.getByText("Project revision conflict; reload before saving", { exact: true }).waitFor();
  await second.frameLocator("iframe[data-import-editor]").getByText("Unsaved second window", { exact: true }).waitFor();
  await second.getByRole("button", { name: "Reload saved project", exact: true }).waitFor(); await second.close();
  assert.equal((await fetch(`${address}/api/import/more`, { method: "POST", headers: authorized, body: "{}" })).status, 200);
  assert.equal((await fetch(`${address}/project.json`, { headers: { Origin: "null" } })).status, 403, "opaque imported frame cannot read privileged APIs");
  const beforeImage = await (await fetch(`${address}/api/import/state`)).json();
  const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  const imageData = Buffer.concat([pixel, Buffer.from("independent replacement")]).toString("base64");
  const assetResult = await (await fetch(`${address}/api/import/asset`, { method: "POST", headers: authorized, body: JSON.stringify({ expectedRevision: beforeImage.project.revision, data: imageData }) })).json();
  const base = await (await fetch(`${address}/import/base/${beforeImage.screens[0].id}`)).json();
  const findImage = node => node.attrs?.alt === "Synthetic image" ? node : node.children?.map(findImage).find(Boolean);
  const imageHistory = [...beforeImage.project.history, { type: "setImage", screenId: beforeImage.screens[0].id, layerId: findImage(base.document.root).id, value: assetResult.assetId }];
  assert.equal((await fetch(`${address}/api/import/save`, { method: "POST", headers: authorized, body: JSON.stringify({ expectedRevision: assetResult.revision, history: imageHistory, cursor: imageHistory.length }) })).status, 200);
  await page.frameLocator("iframe[data-import-editor]").locator(`img[alt="Synthetic image"][src$="${imageData}"]`).waitFor({ state: "attached", timeout: 10000 });
  await stop();
  const reopened = await start(["open", directory]); let outside = 0;
  await page.route("**/*", route => { if (!route.request().url().startsWith(reopened)) { outside++; return route.abort(); } return route.continue(); });
  await page.goto(reopened); await page.getByRole("button", { name: "Edit", exact: true }).click();
  const frame = page.frameLocator("iframe[data-import-editor]"); await frame.getByText("Edited landscape", { exact: true }).waitFor();
  assert.equal(outside, 0, "saved project reopens without the source site"); assert.equal(site.mutations(), 0);
  console.log("PASS public CLI URL → App Canvas landscape → edit → save → close → open → saved offline UI, all unauthorized writes denied, concurrent-window conflict retains unsaved edits.");
} finally { await stop(); await browser?.close(); await site.close(); await rm(root, { recursive: true, force: true }); }
