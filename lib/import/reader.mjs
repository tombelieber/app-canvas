import { readRenderedDocument } from "./capture-dom.js";
import { htmlTags, svgTags, limits } from "./schema.mjs";
import { styleProperties } from "./styles.mjs";

// A browser tool can evaluate this self-contained, read-only function string.
// The length prefix lets the receiver reject incomplete/truncated tool output.
export function captureScript({ redacted = false, allowText = [] } = {}) {
  if (!Array.isArray(allowText) || allowText.length > 1000 || allowText.some(value => typeof value !== "string" || value.length > 500)) throw Error("allowText must be an array of at most 1000 public labels");
  if (allowText.length && !redacted) throw Error("allowText requires redacted mode");
  const options = { properties: styleProperties, allowedHtml: [...htmlTags], allowedSvg: [...svgTags], maxNodes: limits.nodes, maxHeight: limits.height, maxCharacters: limits.state / 2, redacted, allowText };
  return `() => {
    const rendered = (${readRenderedDocument.toString()})(${JSON.stringify(options)});
    if (rendered.paused) return rendered;
    const source = new URL(location.href);
    if (!["http:","https:"].includes(source.protocol) || source.username || source.password) throw Error("Capture requires an HTTP(S) document without credentials");
    source.search = ""; source.hash = "";
    source.pathname = source.pathname.replace(/\\b(?:[a-f0-9]{20,}|[a-f0-9]{8}-[a-f0-9-]{27,})\\b/gi, "_id");
    const base = new URL(rendered.baseUrl); base.search = ""; base.hash = "";
    if (base.username || base.password) throw Error("Private document base URL");
    rendered.baseUrl = base.href;
    const json = JSON.stringify({version:1, url:source.href, redacted:${JSON.stringify(redacted)}, rendered, resources:[]});
    const parts = [String(json.length)];
    for (let i = 0; i < json.length; i += 60000) parts.push(json.slice(i, i + 60000));
    return parts;
  }`;
}
