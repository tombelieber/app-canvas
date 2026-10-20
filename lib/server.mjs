import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { build } from "esbuild";
import { chromium } from "playwright";
import { loadProject } from "./config.mjs";
import { validateProject, localOrigin, publicProject } from "./protocol.mjs";
import { createVitePreview } from "./vite.mjs";
import { verifyCanvas, validatePopulationProof } from "./verify.mjs";
import { checkSourceCoverage } from "./inventory.mjs";
import { canvasHtml } from "./html.mjs";
import { exportCanvas } from "./static.mjs";
import { bundleNotices } from "./licenses.mjs";
import { measureScreen } from "./measure.mjs";
import { bridgeHtml } from "./bridge-html.mjs";
import { overviewDocument } from "../ui/overview-document.js";
import { snapshotStream } from "./snapshot-stream.mjs";
import { validateNativeOverview } from "./native-overview.mjs";

export const packageRoot = fileURLToPath(new URL("..", import.meta.url));
export async function startCanvas({
  config,
  configPath,
  root = process.cwd(),
  port,
  watchFiles = true,
  telemetry = null,
  snapshots = true, // Legacy option: now controls DOM measurement, never images.
} = {}) {
  let project = validateProject(
    config || (await loadProject(configPath, root)),
  );
  const output = join(
    root,
    "node_modules/.cache/app-canvas",
    `run-${randomUUID()}`,
  );
  await mkdir(output, { recursive: true });
  let browser,
    preview,
    closed = false,
    busy = false,
    queued = false,
    timer;
  let manifest = {
    revision: 0,
    status: "building",
    total: project.catalog.length,
    screens: {},
  };
  const listeners = new Set(),
    watchers = [];
  const emit = () => {
    let data;
    const frame = () => data ??= `data: ${JSON.stringify(manifest)}\n\n`;
    for (const stream of listeners) stream.push(frame);
  };
  const server = createServer(async (req, res) => {
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || "")) {
      res.writeHead(403);
      res.end("Loopback only");
      return;
    }
    const url = new URL(req.url, "http://127.0.0.1");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    try {
      if (url.pathname === "/telemetry.json") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(telemetry ? { ...telemetry.config(), local: true } : { enabled: false, configurable: false })); return;
      }
      if (["/telemetry", "/telemetry/preference"].includes(url.pathname)) {
        if (!telemetry || req.method !== "POST" || req.headers.origin !== address || !req.headers["content-type"]?.startsWith("application/json")) { res.writeHead(403);res.end();return; }
        let body = "", size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 2048) {res.writeHead(413);res.end();return;} body += chunk; }
        let input;try { input = JSON.parse(body); } catch {res.writeHead(400);res.end();return;}
        if (url.pathname.endsWith("preference")) {
          if (typeof input.enabled !== "boolean" || Object.keys(input).length !== 1) {res.writeHead(400);res.end();return;}
          res.writeHead(await telemetry.setEnabled(input.enabled) ? 204 : 503);res.end();return;
        }
        const { sanitizeEvent } = await import("./telemetry-contract.mjs");
        const event = sanitizeEvent(input);
        if (!event || event.id !== telemetry.config().id) {res.writeHead(400);res.end();return;}
        const ok = await telemetry.capture(event.event, event.properties);
        res.writeHead(ok ? 204 : 503);res.end();return;
      }
      if (url.pathname === "/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          Connection: "keep-alive",
        });
        const stream = snapshotStream(res, () => listeners.delete(stream));
        listeners.add(stream);
        stream.push(() => `data: ${JSON.stringify(manifest)}\n\n`);
        return;
      }
      if (url.pathname === "/project.json") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(publicProject(project)));
        return;
      }
      if (url.pathname === "/manifest.json") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(manifest));
        return;
      }
      if (url.pathname === "/") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(canvasHtml({ frameOrigin: preview ? localOrigin(preview.url(project.catalog[0])) : "", assetVersion: manifest.canvasHash }));
        return;
      }
      const file = url.pathname.match(/^\/assets\/(canvas\.(?:js|css)|frame-bridge\.js|overview\.html|dom-[a-zA-Z0-9_-]+\.(?:html|json))$/);
      if (file) {
        res.setHeader(
          "Content-Type",
          file[1].endsWith("html") ? "text/html; charset=utf-8" : file[1].endsWith("json") ? "application/json" : file[1].endsWith("css") ? "text/css" : "text/javascript",
        );
        res.end(await readFile(join(output, file[1])));
        return;
      }
      const end = res.end.bind(res);
      res.end = (body, ...args) => {
        if (body && String(res.getHeader("Content-Type")).startsWith("text/html")) {
          body = bridgeHtml(String(body), `${address}/assets/frame-bridge.js`, address);
          res.removeHeader("Content-Length");
        }
        return end(body, ...args);
      };
      if (await preview?.handle?.(req, res, url)) return;
      res.writeHead(404);
      res.end("Not found");
    } catch (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500);
      res.end("Preview resource unavailable");
    }
  });
  await new Promise((yes, no) => {
    server.once("error", no);
    server.listen(port ?? project.port ?? 6106, "127.0.0.1", yes);
  });
  const address = `http://127.0.0.1:${server.address().port}`;
  try {
    preview = await project.preview({
      root,
      canvasOrigin: address,
      artifactDir: output,
      packageRoot,
      build,
      bridgeHtml: (html) => bridgeHtml(html, `${address}/assets/frame-bridge.js`, address),
      createVitePreview: (options) =>
        createVitePreview({ ...options, root, packageRoot, canvasOrigin: address, bridgePath: join(output, "frame-bridge.js") }),
    });
    localOrigin(preview.url(project.catalog[0]));
  } catch (error) {
    await new Promise((resolve) => server.close(resolve));
    throw error;
  }
  async function rebuild() {
    if (busy) {
      queued = true;
      return;
    }
    if (closed) return;
    busy = true;
    try {
      if (configPath) project = await loadProject(configPath, root);
      manifest = {
        revision: manifest.revision + 1,
        status: "building",
        total: project.catalog.length,
        screens: {},
      };
      emit();
      await preview.build?.();
      try {
        manifest.nativeOverview = validateNativeOverview(preview.nativeOverview, project.catalog, address);
      } catch (error) {
        // An optional accelerator cannot invalidate an existing live preview.
        manifest.nativeOverviewError = error.message;
      }
      await writeFile(join(output, "overview.html"), overviewDocument(randomUUID()));
      await build({ absWorkingDir: packageRoot, entryPoints: ["lib/frame-bridge.js"], bundle: true, format: "iife", target: ["safari16.4"], outfile: join(output, "frame-bridge.js"), logLevel: "silent" });
      const bundle = await build({
        absWorkingDir: packageRoot,
        entryPoints: ["ui/canvas.jsx"],
        bundle: true,
        format: "esm",
        target: ["safari16.4"],
        outfile: join(output, "canvas.js"),
        // The viewer runs on phones too. Do not ship React's development
        // bookkeeping/profiling code with every published canvas.
        define: { "process.env.NODE_ENV": '"production"' },
        minify: true,
        logLevel: "silent",
        metafile: true,
      });
      await writeFile(join(output, "canvas-LICENSES.txt"), await bundleNotices(bundle.metafile, packageRoot));
      manifest.canvasHash = createHash("sha256")
        .update(await readFile(join(output, "canvas.js")))
        .update(await readFile(join(output, "canvas.css")))
        .update(JSON.stringify(publicProject(project)))
        .digest("hex");
      emit();
      if (snapshots) {
        browser ??= await chromium.launch({ headless: true });
        let index = 0;
        await Promise.all(
          Array.from(
            { length: Math.min(project.concurrency || 3, 6) },
            async () => {
              while (index < project.catalog.length && !closed) {
                const scenario = project.catalog[index++];
                manifest.screens[scenario.id] = await measureScreen({ browser, project, scenario, preview, address, output });
                emit();
              }
            },
          ),
        );
      }
      if (!snapshots) for (const scenario of project.catalog) manifest.screens[scenario.id] = { ...(scenario.viewport || project.viewport || { width: 390, height: 844 }), url: preview.url(scenario) };
      manifest.renderMode = "live";
      manifest.status = Object.values(manifest.screens).some((s) => s.error)
        ? "error"
        : "ready";
      manifest.updatedAt = new Date().toISOString();
      emit();
      await writeFile(
        join(output, "manifest.json"),
        JSON.stringify(manifest, null, 2),
      );
      console.log(
        `${project.title}: ${manifest.status} ${Object.keys(manifest.screens).length}/${project.catalog.length} · ${address}`,
      );
    } catch (error) {
      manifest.status = "error";
      manifest.error = error.message;
      emit();
      console.error(error.message);
    } finally {
      busy = false;
      if (queued && !closed) {
        queued = false;
        await rebuild();
      }
    }
  }
  const firstBuild = rebuild();
  if (watchFiles)
    for (const path of [
      ...(project.watchPaths || []),
      ...(configPath ? [configPath] : []),
    ]) {
      watchers.push(
        watch(resolve(root, path), { recursive: true }, (_, filename) => {
          if (
            filename &&
            /(^|\/)(node_modules|\.artifacts|dist|\.git)\//.test(filename)
          )
            return;
          clearTimeout(timer);
          timer = setTimeout(() => void rebuild(), 400);
        }),
      );
    }
  async function verify({ complete = false } = {}) {
    await firstBuild;
    if (complete) {
      project = validateProject({ ...project, coverage: { ...project.coverage, requireSourceInventory: true, requireAllCases: true, requireConnected: true } });
      project.sourceCoverageReport = await checkSourceCoverage(project, root, { complete: true });
      if (typeof project.verify !== "function") throw Error("Complete validation requires source-linked runtime evidence");
    }
    if (manifest.status !== "ready")
      throw Error("Some registered screens failed");
    browser ??= await chromium.launch({ headless: true });
    await verifyCanvas({ browser, address, project });
    const proof = await project.verify?.({
      browser,
      canvasOrigin: address,
      preview,
      manifest,
      sourceCoverage: project.sourceCoverageReport,
    });
    if (complete) {
      await validatePopulationProof({ root, project, proof });
      const current = await checkSourceCoverage(project, root, { complete: true });
      if (current.digest !== project.sourceCoverageReport.digest) throw Error("Source changed during population verification");
    }
    return {
      ...manifest,
      interactionsVerified: typeof project.verify === "function",
    };
  }
  async function close() {
    closed = true;
    clearTimeout(timer);
    watchers.forEach((w) => w.close());
    listeners.forEach((r) => r.end());
    await browser?.close();
    await preview.close?.();
    await new Promise((resolve) => server.close(resolve));
  }
  return {
    address,
    firstBuild,
    close,
    verify,
    rebuild,
    getManifest: () => manifest,
    async exportStatic({ outDir }) {
      await firstBuild;
      return exportCanvas({ output, outDir, project, preview, manifest });
    },
  };
}
