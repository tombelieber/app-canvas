import { inspectAsset } from "./assets.mjs";
// SVG-as-image is decoded in a separate, script-disabled browser context.
// A deny-all route and CSP prevent external references; only PNG bytes leave.
export function createRasterizer(browser) {
  let context;
  return {
    async convert(body, width = 128, height = 128) {
      context ||= browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block", viewport: { width: 2048, height: 2048 }, deviceScaleFactor: 1 });
      const page = await (await context).newPage();
      await page.route("**/*", route => route.abort());
      try {
        await page.setContent(`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'none'; base-uri 'none'; form-action 'none'"><style>body{margin:0}img{display:block;max-width:2048px;max-height:2048px}</style><img src="data:image/svg+xml;base64,${body.toString("base64")}">`);
        const image = page.locator("img"), natural = await image.evaluate(el => ({ width: el.naturalWidth, height: el.naturalHeight }));
        if (!natural.width || !natural.height) throw Error("Unsupported SVG image");
        const scale = Math.min(2048 / natural.width, 2048 / natural.height, Math.max(1, Math.max(width * 2 / natural.width, height * 2 / natural.height)));
        await image.evaluate((el, size) => { el.style.width = `${size.width}px`; el.style.height = `${size.height}px`; }, { width: Math.ceil(natural.width * scale), height: Math.ceil(natural.height * scale) });
        return inspectAsset(await image.screenshot({ type: "png", animations: "disabled", timeout: 10000 }));
      } finally { await page.close(); }
    },
    async close() { await (await context)?.close(); },
  };
}
