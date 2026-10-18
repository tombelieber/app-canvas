import { assetId, validateStyle } from "./styles.mjs";
export { assetId } from "./styles.mjs";
export const limits = Object.freeze({ asset: 8 * 1024 ** 2, state: 32 * 1024 ** 2, project: 256 * 1024 ** 2, states: 50, observations: 200, height: 16000, nodes: 30000 });
export const htmlTags = new Set("body div span main section article aside nav header footer h1 h2 h3 h4 h5 h6 p a button label input textarea select option optgroup output form fieldset legend ul ol li dl dt dd table thead tbody tfoot tr td th caption colgroup col figure figcaption blockquote pre code strong em b i u s small sub sup mark time progress meter hr br img picture details summary dialog".split(" "));
export const svgTags = new Set("svg g path rect circle ellipse line polyline polygon text tspan defs linearGradient radialGradient stop clipPath mask pattern symbol use image title desc".split(" "));
const attributes = new Set("id role title aria-label type value placeholder checked selected multiple rows cols min max step viewBox preserveAspectRatio d x y x1 x2 y1 y2 cx cy r rx ry width height points fill stroke stroke-width fill-rule clip-rule clip-path mask offset stop-color stop-opacity gradientUnits gradientTransform patternUnits patternContentUnits patternTransform transform text-anchor dominant-baseline href src alt colspan rowspan open".split(" "));
const unsafeKeys = new Set(["__proto__", "constructor", "prototype"]);
export function identity(value) { if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(value)) throw Error("Invalid document or layer identity"); return value; }
export function text(value, max = 10000) { if (typeof value !== "string" || value.length > max) throw Error("Invalid text"); return value; }
export function plain(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Object.keys(value).some(key => unsafeKeys.has(key))) throw Error("Expected plain data object");
  return value;
}
export function finite(value, low = -16000, high = 16000) { if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high) throw Error("Invalid geometry"); return value; }
export function safeUrl(value) {
  const url = new URL(text(value, 2048));
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error("Invalid source URL");
  return url.href;
}
export function validateDocument(doc) {
  plain(doc); identity(doc.id);
  if (doc.version !== 1) throw Error("Unsupported document version");
  finite(doc.viewport?.width, 200, 2400); finite(doc.viewport?.height, 200, 4000); finite(doc.height, doc.viewport.height, limits.height);
  if (!Array.isArray(doc.fonts) || doc.fonts.length > 200 || !Array.isArray(doc.issues)) throw Error("Invalid document metadata");
  for (const font of doc.fonts) {
    plain(font); text(font.family, 200); text(font.weight, 50); text(font.style, 50);
    if (!assetId(font.asset) || !/^[\w .,'"-]+$/.test(font.family) || !/^[\w .%-]+$/.test(font.weight + font.style)) throw Error("Invalid local font");
  }
  const ids = new Set(); let count = 0;
  const visit = (node, depth) => {
    plain(node); identity(node.id); if (ids.has(node.id) || depth > 100 || ++count > limits.nodes) throw Error("Duplicate layer identity or document too complex"); ids.add(node.id);
    if (node.baseId !== undefined) identity(node.baseId);
    if (node.name !== undefined) text(node.name, 200);
    if (node.hidden !== undefined && typeof node.hidden !== "boolean") throw Error("Invalid visibility");
    if (node.offset) { finite(node.offset.x); finite(node.offset.y); }
    if (node.rect) for (const key of ["x", "y", "width", "height"]) finite(node.rect[key], -1000000, 1000000);
    if (node.text !== undefined) {
      text(node.text, 100000); if (node.tag || node.children) throw Error("Invalid text layer");
    } else {
      if (!htmlTags.has(node.tag) && !svgTags.has(node.tag)) throw Error("Unsupported document tag");
      plain(node.attrs || {});
      for (const [name, value] of Object.entries(node.attrs || {})) {
        if (!attributes.has(name)) throw Error("Unsupported document attribute"); text(value, 100000);
        if (["src", "href"].includes(name) && !(value.startsWith("asset:") && assetId(value.slice(6))) && !(name === "href" && /^#[a-zA-Z0-9_:-]+$/.test(value))) throw Error("Attribute resource must be a local asset");
        if (["fill", "stroke", "clip-path", "mask"].includes(name)) validateStyle(name, value);
        if (name === "type" && !["text", "number", "checkbox", "radio", "range", "date", "time", "button", "search", "color"].includes(value)) throw Error("Unsupported input type");
      }
      if (!Array.isArray(node.children)) throw Error("Missing document children");
      for (const child of node.children) visit(child, depth + 1);
    }
    if (node.style) { plain(node.style); for (const [key, value] of Object.entries(node.style)) validateStyle(key, value); }
  };
  visit(doc.root, 0); return doc;
}
export function validateProject(project) {
  plain(project);
  if (project.kind !== "web-import" || project.version !== 1 || !Number.isInteger(project.revision) || project.revision < 0) throw Error("Invalid import project");
  text(project.title, 200);
  for (const key of ["screens", "flows", "observations", "assets", "history"]) if (!Array.isArray(project[key])) throw Error("Invalid project collection");
  if (!Number.isInteger(project.cursor) || project.cursor < 0 || project.cursor > project.history.length || project.history.length > 2000 || project.screens.length > 1000 || project.observations.length > 10000) throw Error("Invalid project history or size");
  const ids = new Set();
  for (const screen of project.screens) {
    plain(screen); identity(screen.id); identity(screen.documentId); text(screen.title, 200); text(screen.pageId, 2048); safeUrl(screen.url);
    if (ids.has(screen.id) || !["captured", "partial"].includes(screen.quality) || !Array.isArray(screen.issues)) throw Error("Invalid imported screen"); ids.add(screen.id);
  }
  for (const flow of project.flows) {
    plain(flow); identity(flow.id); if (!ids.has(flow.from) || !ids.has(flow.to) || !["observed", "reference"].includes(flow.kind)) throw Error("Invalid imported flow"); text(flow.label, 200);
    if (flow.kind === "observed") identity(flow.actionId);
  }
  for (const asset of project.assets) { if (!assetId(asset.id) || !/^(image\/(png|jpeg|webp|gif)|font\/(woff2?|ttf|otf))$/.test(asset.mime)) throw Error("Invalid local asset"); }
  return project;
}
