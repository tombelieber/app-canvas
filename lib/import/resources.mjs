import parse from "css-tree/parser";
import walk from "css-tree/walker";
import generate from "css-tree/generator";
import { inspectAsset } from "./assets.mjs";
import { limits } from "./schema.mjs";
import { createRasterizer } from "./raster.mjs";

// Keep only browser-fetched presentation resources. Never collect API bodies,
// request headers, cookies, storage, or credentials for replay.
export function observeResources(page) {
  const cache = new Map(), styles = new Map(), vectors = new Map(), jobs = new Set(), queue = [], raster = createRasterizer(page.context().browser()); let active = 0, bytes = 0, closed = false;
  const drain = () => {
    while (!closed && active < 4 && queue.length) {
      const response = queue.shift(); active++;
      const job = (async () => {
        const type = response.request().resourceType(), length = Number(response.headers()["content-length"] || 0);
        if (length > limits.asset || bytes >= limits.project) return;
        const body = await response.body();
        if (body.length > limits.asset || bytes + body.length > limits.project) return;
        if (type === "stylesheet") { styles.set(response.url(), body.toString("utf8")); bytes += body.length; return; }
        try { const asset = inspectAsset(body); cache.set(response.url(), asset); bytes += body.length; } catch { if (type === "image" && response.headers()["content-type"]?.includes("image/svg+xml")) { vectors.set(response.url(), body); bytes += body.length; } }
      })().catch(() => {}).finally(() => { active--; jobs.delete(job); drain(); });
      jobs.add(job);
    }
  };
  const onResponse = response => {
    if (!["image", "font", "stylesheet"].includes(response.request().resourceType()) || !response.ok() || closed) return;
    if (queue.length >= 1000) return; queue.push(response); drain();
  };
  page.on("response", onResponse);
  const lookup = value => {
    if (value.startsWith("data:")) {
      const match = value.match(/^data:(?:image\/(?:png|jpeg|gif|webp)|font\/[a-z0-9-]+);base64,([A-Za-z0-9+/=\s]+)$/);
      if (!match || match[1].length > limits.asset * 1.4) return null;
      try { return inspectAsset(Buffer.from(match[1], "base64")); } catch { return null; }
    }
    return cache.get(value);
  };
  return {
    lookup,
    async prepare(requests) {
      let index = 0;
      await Promise.all(Array.from({ length: Math.min(4, requests.length) }, async () => {
        while (index < requests.length && !closed) {
          const request = requests[index++]; if (lookup(request.url)) continue;
          let svg = vectors.get(request.url);
          if (!svg && request.url.startsWith("data:image/svg+xml") && request.url.length <= limits.asset * 3) {
            try { const comma = request.url.indexOf(","); svg = request.url.slice(0, comma).includes(";base64") ? Buffer.from(request.url.slice(comma + 1), "base64") : Buffer.from(decodeURIComponent(request.url.slice(comma + 1))); } catch { /* malformed image */ }
          }
          if (!svg || svg.length > limits.asset) continue;
          try { const asset = await raster.convert(svg, request.width, request.height); if (bytes + asset.body.length <= limits.project) { cache.set(request.url, asset); bytes += asset.body.length; } } catch { /* capture reports unavailable resource */ }
        }
      }));
    },
    async flush() {
      let timeout;
      await Promise.race([ (async () => { while (jobs.size || queue.length) await Promise.allSettled([...jobs]); })(), new Promise(resolve => { timeout = setTimeout(resolve, 10000); }) ]).finally(() => clearTimeout(timeout));
    },
    fonts(usedFamilies, embeddedStyles = []) {
      return localFonts(lookup, usedFamilies, [...styles, ...embeddedStyles]);
    },
    async close() { closed = true; queue.length = 0; page.off("response", onResponse); cache.clear(); styles.clear(); vectors.clear(); await raster.close(); },
  };
}

export function localFonts(lookup, usedFamilies, sheets) {
  const fonts = [], assets = [];
  for (const [base, css] of sheets) {
    try {
      const ast = parse(css);
      walk(ast, { visit: "Atrule", enter(node) {
        if (node.name.toLowerCase() !== "font-face" || !node.block) return;
        const declarations = Object.fromEntries([...node.block.children].filter(n => n.type === "Declaration").map(n => [n.property, n.value]));
        if (!declarations["font-family"] || !declarations.src) return;
        const family = generate(declarations["font-family"]).replace(/^['"]|['"]$/g, "");
        if (!usedFamilies.some(value => value.toLowerCase().includes(family.toLowerCase()))) return;
        const sources = []; walk(declarations.src, n => { if (n.type === "Url") sources.push(n.value); });
        for (const source of sources) {
          const asset = lookup(new URL(source, base).href); if (!asset?.mime.startsWith("font/")) continue;
          const font = { family, weight: declarations["font-weight"] ? generate(declarations["font-weight"]) : "normal", style: declarations["font-style"] ? generate(declarations["font-style"]) : "normal", asset: asset.id, ...(declarations["unicode-range"] ? { unicodeRange: generate(declarations["unicode-range"]) } : {}) };
          if (!fonts.some(existing => JSON.stringify(existing) === JSON.stringify(font))) { fonts.push(font); assets.push(asset); } break;
        }
      } });
    } catch { /* unsupported stylesheet syntax cannot introduce active CSS */ }
  }
  return { fonts, assets };
}
