import { inspectAsset } from "./assets.mjs";
import { localFonts } from "./resources.mjs";
import { limits, plain, text } from "./schema.mjs";

// Presentation bytes already observed by the authorized browser. No fetch,
// filesystem paths, request headers or session state enter this adapter.
export function agentResources(entries, issues) {
  if (!Array.isArray(entries) || entries.length > 1000) throw Error("Invalid presentation resources");
  const cache = new Map(), sheets = []; let bytes = 0;
  for (const entry of entries) {
    plain(entry); const url = new URL(text(entry.url, 20000));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("Invalid presentation resource URL");
    if (!["image", "font", "stylesheet"].includes(entry.kind) || typeof entry.data !== "string" || entry.data.length > limits.asset * 1.4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(entry.data)) throw Error("Invalid presentation resource encoding");
    const body = Buffer.from(entry.data, "base64"); bytes += body.length;
    if (!body.length || body.length > limits.asset || bytes > limits.state) throw Error("Presentation resources exceed capture budget");
    if (entry.kind === "stylesheet") { sheets.push([url.href, body.toString("utf8")]); continue; }
    // External SVG needs an owned browser's isolated rasterizer. Never replay it.
    let asset;
    try { asset = inspectAsset(body); }
    catch { issues.push("Unsupported presentation resource; supply a browser-produced raster image"); continue; }
    if (!asset.mime.startsWith(`${entry.kind}/`)) throw Error("Presentation resource kind does not match bytes");
    cache.set(url.href, asset);
  }
  const lookup = value => {
    if (!value.startsWith("data:")) return cache.get(value);
    const match = value.match(/^data:(?:image\/(?:png|jpeg|gif|webp)|font\/[a-z0-9-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match || match[1].length > limits.asset * 1.4) return null;
    try { return inspectAsset(Buffer.from(match[1], "base64")); } catch { return null; }
  };
  return { lookup, async prepare() {}, fonts(families, embedded = []) { return localFonts(lookup, families, [...sheets, ...embedded]); } };
}
