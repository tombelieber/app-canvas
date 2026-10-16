import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { startCanvas } from "../lib/server.mjs";
const root = await mkdtemp(join(tmpdir(), "app-canvas-watch-"));
const source = join(root, "screen.html");
const html = (text) =>
  `<!doctype html><html data-review-ready="true"><body style="font:40px sans-serif"><button>${text}</button></body></html>`;
await writeFile(source, html("Before source edit"));
const { readFile } = await import("node:fs/promises");
const app = await startCanvas({
  root,
  port: 0,
  config: {
    title: "Source watcher",
    groups: [{ id: "app", title: "Pages" }],
    catalog: [
      {
        id: "home",
        title: "Home",
        group: "app",
        viewport: { width: 600, height: 400 },
      },
    ],
    watchPaths: ["screen.html"],
    preview: async ({ canvasOrigin }) => ({
      url: () => `${canvasOrigin}/frame`,
      handle: async (req, res, url) => {
        if (url.pathname !== "/frame") return false;
        res.setHeader("Content-Type", "text/html");
        res.end(await readFile(source));
        return true;
      },
    }),
  },
});
const stop = new AbortController();
const browser = await chromium.launch({ headless: true });
try {
  await app.firstBuild;
  assert.equal(app.getManifest().status, "ready");
  const page = await browser.newPage();
  await page.goto(app.address);
  const overview = await browser.newPage();
  await overview.goto(app.address);
  await overview.frameLocator('iframe[data-overview]').locator('[data-preview="home"]').getByRole("button", { name: "Before source edit" }).waitFor();
  await page.getByRole("button", {name:"▶ 操作 App",exact:true}).click();
  const frame = page.frameLocator('iframe[data-screen="home"]');
  await frame.getByRole("button", { name: "Before source edit" }).waitFor();
  const before = app.getManifest().revision;
  const response = await fetch(`${app.address}/events`, {
    signal: stop.signal,
  });
  const reader = response.body.getReader();
  const changed = (async () => {
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw Error("Source event stream closed");
      buffer += new TextDecoder().decode(value);
      const lines = buffer.split("\n\n");
      buffer = lines.pop();
      for (const line of lines) {
        const current = JSON.parse(line.slice(6));
        if (current.revision > before && current.status === "ready") return current;
      }
    }
  })();
  await writeFile(source, html("After source edit"));
  const timeout = setTimeout(() => stop.abort(), 15000);
  try {
    await changed;
  } finally {
    clearTimeout(timeout);
  }
  await frame.getByRole("button", { name: "After source edit" }).waitFor();
  await overview.frameLocator('iframe[data-overview]').locator('[data-preview="home"]').getByRole("button", { name: "After source edit" }).waitFor();
  assert.equal(await page.locator(".screen-frame img").count(), 0);
  await app.verify();
  console.log("PASS: source edit → event → mounted real UI refreshes without screenshot output");
} finally {
  stop.abort();
  await browser.close();
  await app.close();
  await rm(root, { recursive: true });
}
