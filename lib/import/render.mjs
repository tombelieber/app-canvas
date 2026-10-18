import { validateDocument } from "./schema.mjs";
import { transformCss } from "./styles.mjs";
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const voidTags = new Set(["input", "img", "hr", "br", "col"]);
export function documentContent(doc, assets = {}) {
  validateDocument(doc);
  const cssCache = new Map();
  const resource = ref => {
    if (ref.startsWith("#")) return ref;
    const asset = assets[ref.slice(6)]; if (!asset) return "data:,";
    return `data:${asset.mime};base64,${asset.data}`;
  };
  const render = node => {
    const styles = Object.entries(node.style || {}).map(([key, value]) => { if (!cssCache.has(value)) cssCache.set(value, transformCss(value, resource)); return `${key}:${cssCache.get(value)}`; });
    if (node.offset) styles.push(`translate:${node.offset.x}px ${node.offset.y}px`);
    if (node.hidden) styles.push("display:none!important");
    if (node.text !== undefined) styles.push(node.offset || node.style?.width ? "display:inline-block" : "display:contents");
    const own = ` data-canvas-layer="${node.id}"${node.uneditable ? ' data-canvas-readonly="true"' : ""}${node.offset ? ` data-canvas-offset-x="${node.offset.x}" data-canvas-offset-y="${node.offset.y}"` : ""} style="${escapeHtml(styles.join(";"))}"`;
    if (node.text !== undefined) return `<span${own} data-canvas-text>${escapeHtml(node.text)}</span>`;
    const attrs = Object.entries(node.attrs || {}).map(([key, value]) => ` ${key}="${escapeHtml(["src", "href"].includes(key) && value.startsWith("asset:") ? resource(value) : value)}"`).join("");
    return `<${node.tag}${own}${attrs}>${voidTags.has(node.tag) ? "" : (node.children || []).map(render).join("") + `</${node.tag}>`}`;
  };
  const fonts = doc.fonts.map(font => `@font-face{font-family:${JSON.stringify(font.family)};font-style:${font.style};font-weight:${font.weight};src:url("${resource(`asset:${font.asset}`)}")}`).join("\n");
  return { body: render(doc.root), fonts };
}
export function renderDocument(doc, { assets = {}, script = "", nonce = "" } = {}) {
  const { body, fonts } = documentContent(doc, assets);
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${script ? `'nonce-${nonce}'` : "'none'"}; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; connect-src 'none'"><style>html{margin:0;width:${doc.viewport.width}px;min-height:${doc.height}px;overflow:hidden}*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}body{margin:0}${fonts}</style></head>${body}${script ? `<script nonce="${nonce}">${script}</script>` : ""}</html>`;
}
export function overviewContent(doc, assets) {
  const { body, fonts } = documentContent(doc, assets);
  return { html: `<html><head></head>${body}</html>`, fonts, background: doc.root.style?.["background-color"] || "white" };
}
