import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { exportStoolSense } from "./static.mjs";

export function createStoolSensePreview({ root, canvasOrigin, catalog, locale = "zh-TW" }) {
  if (!["en", "zh-TW"].includes(locale)) throw Error("Unsupported StoolSense demo locale");
  const publicDir = join(root, "examples/stoolsense/public");
  const localized = locale === "en" ? join(publicDir, "en") : publicDir;
  return {
    exportDom: true,
    exportStatic: ({ outDir }) => exportStoolSense({ publicDir, outDir, catalog, locale }),
    url: screen => `${canvasOrigin}/frame?id=${encodeURIComponent(screen.id)}`,
    async handle(_request, response, url) {
      const files = {
        "/frame": [join(localized, "index.html"), "text/html; charset=utf-8"],
        "/assets/frame.js": [join(localized, "frame.js"), "text/javascript"],
        "/style.css": [join(publicDir, "style.css"), "text/css"],
        "/sample.png": [join(publicDir, "sample.png"), "image/png"],
        "/diet-template.csv": [join(localized, "diet-template.csv"), "text/csv"],
        "/invalid-meals.csv": [join(localized, "invalid-meals.csv"), "text/csv"],
      };
      const file = files[url.pathname] || (/^\/api\/images\/[^/]+$/.test(url.pathname) ? files["/sample.png"] : null);
      if (!file) return false;
      response.setHeader("Content-Type", file[1]); response.end(await readFile(file[0])); return true;
    },
  };
}
