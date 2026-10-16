import { readFile } from "node:fs/promises";
import { join } from "node:path";
import example from "./catalog.json";
import { exportStoolSense } from "./static.mjs";
import { createJourneys } from "./journeys.mjs";
export default {
  title: "StoolSense",
  port: 6106,
  ...example,
  journeys: createJourneys(example.catalog),
  coverage: { requireAllCases: true, requireConnected: true },
  links: {
    repository: "https://github.com/tombelieber/app-canvas",
    agentGuide: "https://github.com/tombelieber/app-canvas/blob/main/AGENT_GUIDE.md",
  },
  async preview({ root, canvasOrigin }) {
    const publicDir = join(root, "examples/stoolsense/public");
    return {
      exportStatic: ({ outDir }) => exportStoolSense({ publicDir, outDir, catalog: example.catalog }),
      url: (s) => `${canvasOrigin}/frame?id=${s.id}`,
      async handle(req, res, url) {
        const files = {
          "/frame": ["index.html", "text/html; charset=utf-8"],
          "/assets/frame.js": ["frame.js", "text/javascript"],
          "/style.css": ["style.css", "text/css"],
          "/sample.png": ["sample.png", "image/png"],
          "/diet-template.csv": ["diet-template.csv", "text/csv"],
          "/invalid-meals.csv": ["invalid-meals.csv", "text/csv"],
        };
        const asset =
          files[url.pathname] ||
          (/^\/api\/images\/[^/]+$/.test(url.pathname)
            ? files["/sample.png"]
            : null);
        if (!asset) return false;
        res.setHeader("Content-Type", asset[1]);
        res.end(await readFile(join(publicDir, asset[0])));
        return true;
      },
    };
  },
};
