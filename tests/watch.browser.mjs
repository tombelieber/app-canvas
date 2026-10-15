import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
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
try {
  await app.firstBuild;
  assert.equal(app.getManifest().status, "ready");
  const hash = async () =>
    createHash("sha256")
      .update(
        await (
          await fetch(`${app.address}${app.getManifest().screens.home.image}`)
        )
          .arrayBuffer()
          .then((b) => Buffer.from(b)),
      )
      .digest("hex");
  const before = await hash();
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
        if (current.revision > 1 && current.status === "ready") return current;
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
  assert.notEqual(
    await hash(),
    before,
    "source edit must regenerate the actual screenshot",
  );
  await app.verify();
  console.log("PASS: source edit → event → regenerated screenshot and live UI");
} finally {
  stop.abort();
  await app.close();
  await rm(root, { recursive: true });
}
