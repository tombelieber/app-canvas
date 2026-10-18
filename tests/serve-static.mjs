import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, join } from "node:path";
export async function serveStatic(directory, prefix = "/nested/app-canvas/") {
  const root = resolve(directory);
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".csv": "text/csv" };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (!url.pathname.startsWith(prefix)) throw Error("outside site");
      let file = resolve(root, decodeURIComponent(url.pathname.slice(prefix.length)) || "index.html");
      if (url.pathname.endsWith("/") && file !== resolve(root, "index.html")) file = join(file, "index.html");
      if (!file.startsWith(root + "/")) throw Error("outside site");
      const data = await readFile(file);
      res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
      res.end(data);
    } catch { res.writeHead(404); res.end("Not found"); }
  });
  await new Promise((yes) => server.listen(0, "127.0.0.1", yes));
  return { url: `http://127.0.0.1:${server.address().port}${prefix}`, close: () => new Promise((yes) => server.close(yes)) };
}
