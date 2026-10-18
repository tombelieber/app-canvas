import { randomUUID } from "node:crypto";
import { readRenderedDocument } from "./capture-dom.js";
import { htmlTags, svgTags, limits, validateDocument } from "./schema.mjs";
import { styleProperties, transformCss } from "./styles.mjs";
import { privateSurface, redactText, sourceUrl } from "./privacy.mjs";

export async function capturePage({ page, resources, label, reason = "manual", trigger }) {
  if (privateSurface(page.url()) || await page.locator('input[type="password"],input[autocomplete="one-time-code"]').filter({ visible: true }).count()) return { paused: true, reason: "Private authentication or credential surface" };
  let fontTimer;
  await Promise.race([page.evaluate(() => document.fonts.ready.then(() => null)), new Promise(resolve => { fontTimer = setTimeout(resolve, 10000); })]).finally(() => clearTimeout(fontTimer));
  await resources.flush();
  const rendered = await page.evaluate(readRenderedDocument, { properties: styleProperties, allowedHtml: [...htmlTags], allowedSvg: [...svgTags], maxNodes: limits.nodes, maxHeight: limits.height, maxCharacters: limits.state / 2 });
  const requests = new Map();
  const prepare = node => {
    const collect = value => { if (!value.startsWith("#")) { const url = new URL(value, rendered.baseUrl).href; if (!requests.has(url)) requests.set(url, { url, width: node.rect?.width || 128, height: node.rect?.height || 128 }); } return value; };
    if (node.resource) collect(node.resource);
    for (const value of Object.values(node.style || {})) if (/url\s*\(/i.test(value)) try { transformCss(value, collect); } catch { /* normalize reports issue */ }
    node.children?.forEach(prepare);
  };
  prepare(rendered.root); await resources.prepare([...requests.values()]);
  const assets = new Map();
  const styleCache = new Map();
  const resource = value => {
    if (value.startsWith("#")) return value;
    const url = new URL(value, rendered.baseUrl).href, asset = resources.lookup(url);
    if (!asset) { rendered.issues.push("Resource unavailable locally"); return "#unavailable-resource"; }
    assets.set(asset.id, asset); return `asset:${asset.id}`;
  };
  const normalize = node => {
    if (!node) throw Error("Page has no capturable body");
    if (node.resource) { const value = resource(node.resource); if (value.startsWith("asset:")) (node.attrs ||= {})[node.tag === "image" ? "href" : "src"] = value; delete node.resource; }
    if (node.style) for (const [key, value] of Object.entries(node.style)) {
      try { if (!styleCache.has(value)) styleCache.set(value, transformCss(value, resource)); node.style[key] = styleCache.get(value); } catch { delete node.style[key]; rendered.issues.push(`Unsupported style: ${key}`); }
    }
    for (const key of ["fill", "stroke", "clip-path", "mask"]) if (node.attrs?.[key]) {
      try { node.attrs[key] = transformCss(node.attrs[key], resource); } catch { delete node.attrs[key]; }
    }
    node.children?.forEach(normalize);
  };
  normalize(rendered.root);
  const fontResources = resources.fonts(rendered.families, rendered.embeddedStyles); for (const asset of fontResources.assets) assets.set(asset.id, asset);
  if (reason === "settling-timeout") rendered.issues.push("Capture settling deadline reached; visible state may still be changing");
  const document = validateDocument({ version: 1, id: `d-${randomUUID()}`, root: rendered.root, viewport: rendered.viewport, height: rendered.height, fonts: fontResources.fonts,
    issues: [...new Set(rendered.issues)], scroll: rendered.scroll });
  let reference;
  try { reference = await page.screenshot({ type: "png", animations: "disabled", mask: rendered.masks.map(selector => page.locator(selector)), maskColor: "#dae2e4", timeout: 10000 }); }
  catch { document.issues.push("Reference screenshot unavailable"); }
  if (Buffer.byteLength(JSON.stringify(document)) + [...assets.values()].reduce((sum, asset) => sum + asset.body.length, 0) + (reference?.length || 0) > limits.state) throw Error("Capture exceeds state resource budget");
  return { document, assets: [...assets.values()], reference, source: { url: sourceUrl(page.url()), title: redactText(rendered.title), label: label && redactText(label), reason, trigger } };
}
