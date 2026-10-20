import { createServer } from "node:http";
import { watch } from "node:fs";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import { createStore } from "./store.mjs";
import { toCanvasProject, importManifest } from "./adapter.mjs";
import { overviewContent, renderDocument } from "./render.mjs";
import { canvasHtml } from "../html.mjs";
import { overviewDocument } from "../../ui/overview-document.js";
import { snapshotStream } from "../snapshot-stream.mjs";
import { bundleNotices } from "../licenses.mjs";
import { identity, limits } from "./schema.mjs";
import { editorRuntime } from "../../ui/import/editor-runtime.js";
import { snapshotCache } from "./snapshots.mjs";
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));

export async function startImportCanvas({ directory, session, port = 6106 }) {
  const store = session?.store || await createStore(directory), token = randomUUID(), listeners = new Set();
  const output = await mkdtemp(join(tmpdir(), "app-canvas-import-runtime-"));
  const result = await build({ absWorkingDir: packageRoot, entryPoints: ["ui/canvas.jsx"], bundle: true, format: "esm", target: ["chrome120"], outfile: join(output, "canvas.js"), define: { "process.env.NODE_ENV": '"production"' }, minify: true, logLevel: "silent", metafile: true });
  await import("node:fs/promises").then(async ({ writeFile }) => {
    await writeFile(join(output, "canvas-LICENSES.txt"), await bundleNotices(result.metafile, packageRoot));
    await writeFile(join(output, "overview.html"), overviewDocument(randomUUID()));
  });
  let closed = false;
  const snapshots = snapshotCache(store), refresh = () => snapshots.refresh();
  const emit = async () => {
    if (closed) return;
    const state = await snapshots.changed(), data = JSON.stringify({ ...importManifest(state), session: session?.status || null });
    for (const stream of listeners) stream.push(() => `data: ${data}\n\n`);
  };
  const json = (res, data, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  const body = async req => {
    if (req.headers["content-type"] !== "application/json") throw Error("JSON content type required");
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > limits.state) throw Error("Request body too large"); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  };
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "no-referrer"); res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (req.headers.host !== new URL(address).host || req.headers.origin && req.headers.origin !== address || req.headers["sec-fetch-site"] === "cross-site") return json(res, { error: "Loopback same-origin access required" }, 403);
    const url = new URL(req.url, address);
    try {
      if (req.method === "POST") {
        if (req.headers.origin !== address || req.headers["x-app-canvas-token"] !== token) return json(res, { error: "Unauthorized write" }, 403);
        const input = await body(req);
        if (url.pathname === "/api/import/save") { const next = await snapshots.update(() => store.save(input)); await emit(); return json(res, { revision: next.project.revision }); }
        if (url.pathname === "/api/import/asset") { const next = await snapshots.update(() => store.asset(Buffer.from(input.data || "", "base64"), input.expectedRevision)); await emit(); return json(res, { assetId: next.assetId, revision: next.project.revision, asset: next.assets[next.assetId] }); }
        if (url.pathname === "/api/import/capture" && session) { await session.capture(typeof input.label === "string" ? input.label.slice(0, 200) : undefined); await emit(); return json(res, { status: session.status }); }
        if (url.pathname === "/api/import/more" && session) { await session.page.keyboard.press("PageDown"); await session.capture("More content"); await emit(); return json(res, { status: session.status }); }
        return json(res, { error: "Unsupported import command" }, 404);
      }
      if (req.method !== "GET") return json(res, { error: "Method not allowed" }, 405);
      if (url.pathname === "/") { res.setHeader("Content-Type", "text/html; charset=utf-8"); return res.end(canvasHtml()); }
      if (url.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
      const asset = url.pathname.match(/^\/assets\/(canvas\.(?:js|css)|overview\.html)$/);
      if (asset) { res.setHeader("Content-Type", asset[1].endsWith("css") ? "text/css" : asset[1].endsWith("html") ? "text/html" : "text/javascript"); return res.end(await readFile(join(output, asset[1]))); }
      const state = await refresh();
      if (url.pathname === "/import/editor") {
        const runtime = identity(url.searchParams.get("runtime")), nonce = randomUUID();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.end(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"></head><body><script nonce="${nonce}">(${editorRuntime.toString()})(${JSON.stringify(runtime)},${url.searchParams.get("prototype") === "1"},[])</script></body></html>`);
      }
      if (url.pathname === "/project.json") return json(res, toCanvasProject(state, token));
      if (url.pathname === "/api/import/state") return json(res, { project: state.baseProject, screens: state.project.screens, manifest: importManifest(state), session: session?.status || null });
      if (url.pathname === "/manifest.json") return json(res, importManifest(state));
      if (url.pathname === "/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", Connection: "keep-alive" });
        const stream = snapshotStream(res, () => listeners.delete(stream)); listeners.add(stream);
        stream.push(() => `data: ${JSON.stringify({ ...importManifest(state), session: session?.status || null })}\n\n`); return;
      }
      const document = url.pathname.match(/^\/import\/(overview|document|base)\/([a-zA-Z0-9_-]+)$/);
      if (document) {
        const id = identity(document[2]), screen = state.project.screens.find(s => s.id === id); if (!screen) return json(res, { error: "Screen unavailable" }, 404);
        const doc = state.documents[id];
        if (document[1] === "base") { const base = await store.base(screen.documentId), used = new Set([...JSON.stringify([base, doc]).matchAll(/[a-f0-9]{64}/g)].map(m => m[0])); return json(res, { document: base, assets: Object.fromEntries(Object.entries(state.assets).filter(([id]) => used.has(id))) }); }
        if (document[1] === "overview") return json(res, overviewContent(doc, state.assets));
        res.setHeader("Content-Type", "text/html; charset=utf-8"); return res.end(renderDocument(doc, { assets: state.assets }));
      }
      json(res, { error: "Resource unavailable" }, 404);
    } catch (error) { json(res, { error: error.persistenceMessage || (error.code === "CONFLICT" ? error.message : "Import request rejected; check the project or selected operation") }, error.code === "CONFLICT" ? 409 : 400); }
  });
  let address;
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  address = `http://127.0.0.1:${server.address().port}`;
  const watcher = watch(store.root, (_, filename) => { if (String(filename) === "project.json") void emit().catch(() => {}); });
  if (session) {
    session.subscribe(() => { void emit().catch(() => {}); });
    session.ready.then(emit, emit);
  }
  return { address, store, emit, async close() { if (closed) return; closed = true; watcher.close(); listeners.forEach(stream => stream.end()); await session?.close(); await new Promise(resolve => server.close(resolve)); await rm(output, { recursive: true, force: true }); } };
}
