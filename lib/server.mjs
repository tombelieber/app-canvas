import { createServer } from "node:http";
import { readFile, mkdir, writeFile, readdir, rm } from "node:fs/promises";
import { watch } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { build } from "esbuild";
import { chromium } from "playwright";
import { loadProject } from "./config.mjs";
import { validateProject, localOrigin, publicProject } from "./protocol.mjs";
import { createVitePreview } from "./vite.mjs";
import { verifyCanvas } from "./verify.mjs";

export const packageRoot = fileURLToPath(new URL("..", import.meta.url));
export async function startCanvas({
  config,
  configPath,
  root = process.cwd(),
  port,
  watchFiles = true,
  snapshots = true,
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
    const data = `data: ${JSON.stringify(manifest)}\n\n`;
    for (const response of listeners) response.write(data);
  };
  const html = () =>
    `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>App canvas</title><link rel="stylesheet" href="/assets/canvas.css"></head><body><div id="root"></div><script type="module" src="/assets/canvas.js"></script></body></html>`;
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
      if (url.pathname === "/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          Connection: "keep-alive",
        });
        res.write(`data: ${JSON.stringify(manifest)}\n\n`);
        listeners.add(res);
        req.on("close", () => listeners.delete(res));
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
        res.end(html());
        return;
      }
      const file = url.pathname.match(/^\/assets\/(canvas\.(?:js|css))$/);
      if (file) {
        res.setHeader(
          "Content-Type",
          file[1].endsWith("css") ? "text/css" : "text/javascript",
        );
        res.end(await readFile(join(output, file[1])));
        return;
      }
      const thumb = url.pathname.match(
        /^\/thumb\/(\d+)\/([a-zA-Z0-9_-]+)\.png$/,
      );
      if (thumb && project.catalog.some((s) => s.id === thumb[2])) {
        res.setHeader("Content-Type", "image/png");
        res.end(await readFile(join(output, thumb[1], `${thumb[2]}.png`)));
        return;
      }
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
      createVitePreview: (options) =>
        createVitePreview({ ...options, root, packageRoot }),
    });
    localOrigin(preview.url(project.catalog[0]));
  } catch (error) {
    await new Promise((resolve) => server.close(resolve));
    throw error;
  }
  async function capture(scenario, revision) {
    const viewport = scenario.viewport ||
      project.viewport || { width: 390, height: 844 };
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 1,
      timezoneId: project.timezone || "Asia/Hong_Kong",
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    const url = preview.url(scenario),
      origin = localOrigin(url),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) =>
      [address, origin].includes(new URL(route.request().url()).origin)
        ? route.continue()
        : route.abort("blockedbyclient"),
    );
    try {
      await page.goto(url, { waitUntil: "load" });
      await page.waitForFunction(
        () => document.documentElement.dataset.reviewReady,
        { timeout: project.timeout || 20000 },
      );
      const result = await page.evaluate(() => ({
        error: document.documentElement.dataset.reviewError,
        errors: window.__review?.errors || window.__appCanvas?.errors || [],
        unmocked: window.__appCanvas?.requests || [],
        height:
          document.documentElement.scrollHeight +
          Math.max(
            0,
            ...[
              ...document.querySelectorAll(
                "main,[role=main],[data-canvas-scroll]",
              ),
            ]
              .filter((el) => el.clientHeight > 0)
              .map((el) => Math.max(0, el.scrollHeight - el.clientHeight)),
          ),
      }));
      if (
        result.error ||
        errors.length ||
        result.errors.length ||
        result.unmocked.length
      )
        throw Error(
          result.error ||
            [
              ...errors,
              ...result.errors,
              ...result.unmocked.map((r) => `Unmocked ${r.method} ${r.path}`),
            ].join("; "),
        );
      await scenario.verify?.(page);
      await page.evaluate(() => {
        if (!document.querySelector("dialog[open]"))
          document.activeElement?.blur();
      });
      const height = Math.max(viewport.height, Math.min(16000, result.height));
      await page.setViewportSize({ ...viewport, height });
      await page.screenshot({
        path: join(output, String(revision), `${scenario.id}.png`),
        fullPage: true,
        animations: "disabled",
      });
      manifest.screens[scenario.id] = {
        width: viewport.width,
        height: await page.evaluate(
          () => document.documentElement.scrollHeight,
        ),
        image: `/thumb/${revision}/${scenario.id}.png`,
        url,
      };
    } catch (error) {
      manifest.screens[scenario.id] = {
        width: viewport.width,
        height: viewport.height,
        url,
        error: error.message,
      };
      console.error(`${scenario.id}: ${error.message}`);
    } finally {
      await page.close();
      emit();
    }
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
      await build({
        absWorkingDir: packageRoot,
        entryPoints: ["ui/canvas.jsx"],
        bundle: true,
        format: "esm",
        target: ["safari16.4"],
        outfile: join(output, "canvas.js"),
        define: { "process.env.NODE_ENV": '"development"' },
        logLevel: "silent",
      });
      manifest.canvasHash = createHash("sha256")
        .update(await readFile(join(output, "canvas.js")))
        .update(await readFile(join(output, "canvas.css")))
        .update(JSON.stringify(publicProject(project)))
        .digest("hex");
      emit();
      if (snapshots) {
        browser ??= await chromium.launch({ headless: true });
        await mkdir(join(output, String(manifest.revision)), {
          recursive: true,
        });
        let index = 0;
        await Promise.all(
          Array.from(
            { length: Math.min(project.concurrency || 3, 6) },
            async () => {
              while (index < project.catalog.length && !closed)
                await capture(project.catalog[index++], manifest.revision);
            },
          ),
        );
      }
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
      for (const entry of await readdir(output))
        if (/^\d+$/.test(entry) && Number(entry) < manifest.revision - 1)
          await rm(join(output, entry), { recursive: true });
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
  async function verify() {
    await firstBuild;
    if (manifest.status !== "ready")
      throw Error("Some registered screens failed");
    await verifyCanvas({ browser, address, project });
    await project.verify?.({
      browser,
      canvasOrigin: address,
      preview,
      manifest,
    });
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
  };
}
