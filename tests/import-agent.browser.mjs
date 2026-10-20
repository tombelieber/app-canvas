import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startImportSite } from "./fixtures/import-site.mjs";
const exec = promisify(execFile), root = await mkdtemp(join(tmpdir(), "app-canvas-agent-e2e-")), site = await startImportSite();
const cli = process.env.APP_CANVAS_TEST_CLI || fileURLToPath(new URL("../bin/app-canvas.mjs", import.meta.url));
const run = async args => JSON.parse((await exec(process.execPath, [cli, ...args], { env: { ...process.env, APP_CANVAS_TELEMETRY: "0" } })).stdout);
let child, browser, source, siteClosed = false;
const start = directory => new Promise((resolve, reject) => {
  child = spawn(process.execPath, [cli, "open", directory, "--port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "", errors = ""; const timer = setTimeout(() => reject(Error(`CLI open timed out: ${errors}`)), 20000);
  child.stdout.on("data", data => { output += data; const url = output.match(/App Canvas import: (http:\/\/127\.0\.0\.1:\d+)/)?.[1]; if (url) { clearTimeout(timer); resolve(url); } });
  child.stderr.on("data", data => errors += data);
  child.once("exit", code => { clearTimeout(timer); if (!output.includes("App Canvas import:")) reject(Error(`CLI failed (${code}): ${errors}`)); });
});
const stop = () => new Promise(resolve => { if (!child || child.exitCode !== null) return resolve(); child.once("exit", resolve); child.kill("SIGTERM"); });
try {
  const directory = join(root, "project"), reader = join(root, "reader.js"), input = join(root, "snapshot.json");
  const created = await run(["import", `${site.url}/calendar`, "--out", directory, "--agent"]);
  assert.equal(created.coverage, "observed");
  await run(["capture-script", "--out", reader]); const script = await readFile(reader, "utf8");
  browser = await chromium.launch(); source = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const observed = new Map(), jobs = new Set();
  source.on("response", response => {
    const kind = response.request().resourceType(); if (!["image", "font", "stylesheet"].includes(kind)) return;
    const job = response.body().then(body => observed.set(response.url(), { url: response.url(), kind, data: body.toString("base64") })).catch(() => {}).finally(() => jobs.delete(job)); jobs.add(job);
  });
  await source.goto(`${site.url}/calendar`); await source.evaluate(() => document.fonts.ready);
  await source.evaluate(() => {
    Object.defineProperty(document, "baseURI", { value: undefined, configurable: true });
    for (const style of ["visibility:hidden", "opacity:0", "content-visibility:hidden"]) {
      const hidden = document.createElement("p"); hidden.style.cssText = style; hidden.textContent = "Hidden private fixture"; document.body.append(hidden);
    }
  });
  const capture = async (label, action) => {
    // No DOM constructor globals: same reader also works in read-only DOM tools.
    const fragments = await source.evaluate(`(() => { const Node=undefined, Element=undefined, CSSRule=undefined; return (${script})(); })()` );
    assert.equal(fragments.slice(1).join("").includes("member@example.test"), false);
    assert.equal(fragments.slice(1).join("").includes("Hidden private fixture"), false, "invisible DOM never enters transport");
    await Promise.allSettled([...jobs]);
    const snapshot = JSON.parse(fragments.slice(1).join("")); snapshot.resources = [...observed.values()];
    await writeFile(input, JSON.stringify(snapshot), { mode: 0o600 });
    return run(["capture", directory, "--input", input, "--label", label, ...(action ? ["--action", action] : [])]);
  };
  const first = await capture("Calendar"); assert.ok(first.issues.some(issue => /Unsupported presentation resource/.test(issue)), "unsupported external SVG is explicit");
  await source.getByRole("button", { name: "All posts", exact: true }).click();
  const second = await capture("Filter menu", "All posts");
  await source.getByRole("button", { name: "Published", exact: true }).click();
  await capture("Published", "Published");
  await source.getByRole("link", { name: "Settings", exact: true }).click();
  const settings = await capture("Settings", "Open Settings");
  await run(["link", directory, "--from", settings.screenId, "--to", first.screenId, "--label", "Related calendar reference"]);
  const report = await run(["status", directory]); assert.equal(report.states, 4); assert.deepEqual(report.flows, { observed: 3, reference: 1 }); assert.equal(report.pages.length, 2);
  assert.notEqual(first.screenId, second.screenId);
  const persisted = JSON.parse(await readFile(join(directory, "project.json"), "utf8"));
  assert.ok(persisted.assets.some(asset => asset.mime === "image/png") && persisted.assets.some(asset => asset.mime === "font/ttf"), "browser-observed images and fonts persist locally");
  assert.deepEqual(persisted.screens[0].viewport, { width: 1600, height: 900 });
  // Explicit allowlisted overview. Unknown text/resources are masked in-browser.
  await source.goto(`${site.url}/api-keys`);
  const paused = await source.evaluate(`(${script})()` ); assert.equal(paused.paused, true);
  await source.evaluate(() => { document.querySelector("h1").textContent = "API overview"; const privateText = document.createElement("p"); privateText.textContent = "Fixture Secret 12345"; privateText.setAttribute("role", "status"); document.body.append(privateText); });
  const labels = join(root, "labels.json"), safeReader = join(root, "safe-reader.js");
  await writeFile(labels, JSON.stringify(["API overview", "Calendar", "Settings"]));
  await run(["capture-script", "--out", safeReader, "--redacted", "--allow-text", labels]);
  const safe = await source.evaluate(`(${await readFile(safeReader, "utf8")})()` ); const safeText = safe.slice(1).join("");
  assert.ok(!safeText.includes("Fixture Secret") && !safeText.includes("member@example.test") && !safeText.includes("/pixel.png"));
  const safeObject = JSON.parse(safeText), roles = [];
  const walk = node => { if (node.attrs?.role) roles.push(node.attrs.role); node.children?.forEach(walk); }; walk(safeObject.rendered.root);
  assert.ok(roles.length > 0 && roles.every(role => role !== "[redacted]"), "structural roles retain their values");
  await writeFile(input, JSON.stringify(safe)); await run(["capture", directory, "--input", input, "--label", "Redacted overview"]);
  await source.goto(`${site.url}/login`); assert.equal((await source.evaluate(`(${await readFile(safeReader, "utf8")})()` )).paused, true, "password pages pause even in redacted mode");
  await source.close(); source = undefined; await site.close(); siteClosed = true;
  const address = await start(directory), page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  let outside = 0; await page.route("**/*", route => { if (!route.request().url().startsWith(address)) { outside++; return route.abort(); } return route.continue(); });
  await page.goto(address); await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Content calendar", exact: true }).last().click();
  await page.getByLabel("Text content", { exact: true }).fill("Saved agent landscape");
  await page.getByRole("button", { name: "Apply text", exact: true }).click(); await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Saved", { exact: true }).waitFor(); assert.equal(outside, 0);
  await stop(); await page.unroute("**/*"); const reopened = await start(directory);
  await page.route("**/*", route => { if (!route.request().url().startsWith(reopened)) { outside++; return route.abort(); } return route.continue(); });
  await page.goto(reopened); await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.frameLocator("iframe[data-import-editor]").getByText("Saved agent landscape", { exact: true }).waitFor();
  assert.equal(outside, 0); assert.equal(site.mutations(), 0);
  assert.equal(await page.locator("iframe[data-import-editor]").evaluate(el => el.style.width), "1600px");
  assert.equal(await page.locator(".import-editor-surface").evaluate(el => Number.parseFloat(el.style.height)), 900 * 390 / 1600);
  assert.equal(await page.frameLocator("iframe[data-import-editor]").getByAltText("Synthetic image", { exact: true }).evaluate(el => el.complete && el.naturalWidth > 0), true);
  await page.getByRole("button", { name: "Prototype", exact: true }).click();
  await page.frameLocator("iframe[data-import-editor]").getByRole("button", { name: "All posts", exact: true }).click();
  await page.locator(".import-states button.active").filter({ hasText: "Filter menu" }).waitFor();
  await page.frameLocator("iframe[data-import-editor]").getByRole("button", { name: "Published", exact: true }).waitFor();
  assert.equal((await page.locator("iframe").count()), 2, "bounded overview + active editor");
  console.log("PASS agent CLI → portable DOM reader → 5 states / observed + reference flows → local image/font assets → edit/Save → stop source + fresh offline reopen; private surfaces paused and allowlist masks before transport.");
} finally { await stop(); await source?.close(); await browser?.close(); if (!siteClosed) await site.close(); await rm(root, { recursive: true, force: true }); }
