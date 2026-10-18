import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Run existing rich player tests unchanged with an active native overview too.
export async function withNativeOverview(config) {
  if (process.env.APP_CANVAS_TEST_NATIVE_ATLAS !== "1") return config;
  const image = await readFile(new URL("./fixtures/native-atlas.png", import.meta.url));
  const sha256 = createHash("sha256").update(image).digest("hex");
  const id = "native-background";
  return { ...config, catalog: [...config.catalog, { id, title: "Native background", group: config.groups[0].id, pageId: config.pages.at(-1).id }],
    preview: async ctx => {
      const original = await config.preview(ctx);
      return { ...original,
        nativeOverview: { url: "/native-atlas.png", sha256, width: 1, height: 1, cases: [{ id, x: 0, y: 0, width: 1, height: 1, sourceSha256: sha256 }] },
        url: s => s.id === id ? ctx.canvasOrigin + "/native-capture" : original.url(s),
        handle(req, res, url) {
          if (url.pathname === "/native-atlas.png") { res.setHeader("Content-Type", "image/png"); res.end(image); return true; }
          if (url.pathname === "/native-capture") { res.setHeader("Content-Type", "text/html"); res.end('<html data-review-ready="true"><body><img src="/native-atlas.png" alt="Synthetic native capture"></body></html>'); return true; }
          return original.handle(req, res, url);
        },
      };
    },
  };
}
