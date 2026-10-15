import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
// Use the host project's Vite, React plugins, aliases and CSS pipeline.
export async function createVitePreview({
  root,
  appRoot = ".",
  configFile = "vite.config.ts",
  entry,
  aliases = [],
  define = {},
  packageRoot,
}) {
  const app = resolve(root, appRoot),
    require = createRequire(join(app, "package.json"));
  const vite = await import(pathToFileURL(require.resolve("vite")).href);
  const loaded = await vite.loadConfigFromFile(
    { command: "serve", mode: "development" },
    resolve(app, configFile),
  );
  const base = loaded?.config || {};
  const alias = Array.isArray(base.resolve?.alias)
    ? base.resolve.alias
    : Object.entries(base.resolve?.alias || {}).map(([find, replacement]) => ({
        find,
        replacement,
      }));
  const server = await vite.createServer({
    ...base,
    configFile: false,
    root: app,
    envDir: false,
    mode: "ui-review",
    define: { ...base.define, ...define },
    resolve: { ...base.resolve, alias: [...aliases, ...alias] },
    plugins: [
      ...(base.plugins || [])
        .flat()
        .filter((p) => p?.name !== "vicai-port-lock"),
      {
        name: "app-canvas-preview",
        enforce: "pre",
        resolveId(id) {
          if (id === "virtual:app-canvas-preview")
            return join(packageRoot, "lib/preview.js");
        },
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const navigation =
              req.method === "GET" &&
              (req.url?.startsWith("/__app_canvas") ||
                req.headers.accept?.includes("text/html"));
            if (!navigation) return next();
            const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`;
            res.setHeader("Content-Type", "text/html");
            res.setHeader(
              "Content-Security-Policy",
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; frame-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'",
            );
            res.setHeader("Cache-Control", "no-store");
            res.end(await server.transformIndexHtml("/__app_canvas", html));
          });
        },
      },
    ],
    server: {
      ...base.server,
      host: "127.0.0.1",
      port: 0,
      strictPort: false,
      open: false,
      proxy: {},
      fs: { allow: [root, app, packageRoot] },
    },
  });
  await server.listen();
  const origin = server.resolvedUrls.local[0]
    .replace(/\/$/, "")
    .replace("localhost", "127.0.0.1");
  return {
    url: (scenario) =>
      `${origin}/__app_canvas?id=${encodeURIComponent(scenario.id)}`,
    close: () => server.close(),
  };
}
