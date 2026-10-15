import { startCanvas } from "../lib/server.mjs";
const app = await startCanvas({
  port: 0,
  watchFiles: false,
  config: {
    title: "Desktop layout control",
    groups: [{ id: "pages", title: "Pages" }],
    catalog: [
      {
        id: "wide",
        title: "Wide page",
        group: "pages",
        viewport: { width: 1280, height: 900 },
      },
    ],
    preview: async ({ canvasOrigin }) => ({
      url: () => `${canvasOrigin}/frame`,
      handle: async (req, res, url) => {
        if (url.pathname !== "/frame") return false;
        res.setHeader("Content-Type", "text/html");
        res.end(
          '<html data-review-ready="true"><body><button>Left control</button></body></html>',
        );
        return true;
      },
    }),
  },
});
try {
  await app.verify();
  console.log(
    "PASS: 1280px live preview retains left controls on a 1512px canvas",
  );
} finally {
  await app.close();
}
