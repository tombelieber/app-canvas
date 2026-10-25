import { spawnSync } from "node:child_process";
import { mkdir, cp, copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

// Keep the existing GitHub Pages synthetic-demo build and its regression gates.
// The product distribution has a marketing root and the same demo at /demo/.
const out = resolve(process.env.AGENT_CANVAS_PRODUCT_DIR || ".artifacts/product");
const site = new URL(process.env.APP_CANVAS_SITE_URL || "https://agent-canvas-app.pages.dev/");
if (site.protocol !== "https:" || site.username || site.password || site.search || site.hash || site.pathname !== "/") {
  throw Error("Product site must be an HTTPS origin without credentials, path or query");
}
const demo = join(out, "demo");
await mkdir(out, { recursive: true });
const result = spawnSync(process.execPath, ["scripts/build-demo.mjs"], {
  stdio: "inherit",
  env: { ...process.env, APP_CANVAS_STATIC_DIR: demo, APP_CANVAS_SITE_URL: site.href, APP_CANVAS_DEMO_URL: new URL("demo/", site).href },
});
if (result.status !== 0) process.exit(result.status || 1);
await cp(join(demo, "about"), join(out, "about"), { recursive: true });
await copyFile(join(demo, "about/index.html"), join(out, "index.html"));
for (const file of ["sitemap.xml", "robots.txt", "llms.txt", "llms-full.txt", "build.json"]) {
  await copyFile(join(demo, file), join(out, file));
}
await writeFile(join(out, "404.html"), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — Agent Canvas</title><h1>Page not found</h1><p><a href="/">Return to Agent Canvas</a></p></html>');
await writeFile(join(out, "_redirects"), "/about/ / 301\n/about/index.html / 301\n");
await writeFile(join(out, "_headers"), "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/build.json\n  Cache-Control: no-cache\n");
const build = JSON.parse(await readFile(join(out, "build.json"), "utf8"));
await writeFile(join(out, "build.json"), JSON.stringify({ ...build, brand: "Agent Canvas", site: site.href, demo: new URL("demo/", site).href }, null, 2));
console.log(`Agent Canvas product: ${out} → ${site.href}`);
