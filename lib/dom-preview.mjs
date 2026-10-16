// The overview reuses HTML/CSS produced by the real app during measurement.
// It runs no application JavaScript. Selection/Interact/playback use the original
// app, so this is neither a screenshot nor a second UI implementation.
import { createHash } from "node:crypto";
const restoreNativeState = "for(const el of document.querySelectorAll('[data-canvas-modal]')){el.removeAttribute('open');el.showModal()}for(const el of document.querySelectorAll('[data-canvas-popover]'))el.showPopover()";
function readDocument() {
  if (document.querySelector("canvas,video,iframe,object,embed") || document.adoptedStyleSheets.length || [...document.querySelectorAll("*")].some(el => el.shadowRoot)) return null;
  const root = document.documentElement.cloneNode(true), resources = [];
  const asset = (value, base = document.baseURI) => {
    if (!value || value.startsWith("#") || value.startsWith("data:")) return value;
    const url = new URL(value, base).href, token = `__APP_CANVAS_ASSET_${resources.length}__`;
    resources.push({ url, token }); return token;
  };
  const css = (text, base) => text.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_, quote, value) => `url("${asset(value, base)}")`);
  const originals = [...document.querySelectorAll("*")], copies = [...root.querySelectorAll("*")];
  // querySelectorAll on Document includes <html>; on Element it does not.
  copies.unshift(root);
  for (let i = 0; i < originals.length; i++) {
    const source = originals[i], copy = copies[i];
    if (source.matches(":modal")) copy.setAttribute("data-canvas-modal", "");
    if (source.matches(":popover-open")) copy.setAttribute("data-canvas-popover", "");
    if (source.matches("style,link[rel=stylesheet]")) {
      try {
        if (source.disabled) return null;
        if ([...source.sheet.cssRules].some(rule => rule.type === CSSRule.IMPORT_RULE)) return null;
        const style = document.createElement("style");
        style.textContent = css([...source.sheet.cssRules].map(rule => rule.cssText).join("\n"), source.sheet.href || document.baseURI);
        if (source.media) style.media = source.media;
        copy.replaceWith(style);
      } catch { return null; } // Inaccessible styles must stay live, never render incorrectly.
    }
    if (source instanceof HTMLInputElement && source.type !== "file") {
      copy.setAttribute("value", source.value);
      copy.toggleAttribute("checked", source.checked);
    }
    if (source instanceof HTMLTextAreaElement) copy.textContent = source.value;
    if (source instanceof HTMLOptionElement) copy.toggleAttribute("selected", source.selected);
    if (source instanceof HTMLImageElement) {
      copy.removeAttribute("srcset"); copy.removeAttribute("loading");
      if (source.complete && !source.naturalWidth) copy.removeAttribute("src");
      else copy.setAttribute("src", asset(source.currentSrc || source.src));
    }
    if (source.matches("image[href]")) copy.setAttribute("href", asset(source.getAttribute("href")));
    if (copy.hasAttribute("style")) copy.setAttribute("style", css(copy.getAttribute("style"), document.baseURI));
    for (const attr of [...copy.attributes]) if (/^on/i.test(attr.name) || ["action", "formaction", "srcdoc", "autofocus"].includes(attr.name)) copy.removeAttribute(attr.name);
    if (source.matches("a,area")) copy.removeAttribute("href");
  }
  root.querySelectorAll("script,noscript,base,link,meta[http-equiv],source").forEach(el => el.remove());
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT), comments = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach(node => node.remove());
  const policy = document.createElement("meta"); policy.httpEquiv = "Content-Security-Policy";
  policy.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; base-uri 'none'; form-action 'none'";
  root.querySelector("head").prepend(policy);
  return { html: `<!doctype html>${root.outerHTML}`, resources, nativeState: !!root.querySelector("[data-canvas-modal],[data-canvas-popover]") };
}

export async function captureDocument({ page, allowedOrigins, cache = new Map() }) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode().catch(() => {}))); });
  const document = await page.evaluate(readDocument);
  if (!document) return null;
  let html = document.html, bytes = Buffer.byteLength(html);
  for (const { url, token } of document.resources) {
    let value;
    if (url.startsWith("blob:")) {
      value = await page.evaluate(async url => {
        // App adapters can replace fetch to isolate their API. Blob conversion
        // must not route a local photo through that mock API contract.
        const blob = await new Promise((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open("GET", url); xhr.responseType = "blob"; xhr.timeout = 5000; xhr.onload = () => resolve(xhr.response); xhr.onerror = xhr.ontimeout = reject; xhr.send(); });
        if (blob.size > 2_000_000) throw Error("DOM preview asset too large");
        return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
      }, url);
    } else {
      if (!allowedOrigins.includes(new URL(url).origin)) return null;
      if (!cache.has(url)) cache.set(url, (async () => {
        const response = await page.request.get(url, { maxRedirects: 0, timeout: 5000 });
        if (!response.ok()) throw Error("DOM preview asset unavailable");
        const body = await response.body();
        if (body.length > 2_000_000) throw Error("DOM preview asset too large");
        return `data:${(response.headers()["content-type"] || "application/octet-stream").split(";")[0]};base64,${body.toString("base64")}`;
      })());
      value = await cache.get(url);
    }
    bytes += value.length;
    if (bytes > 16_000_000) return null;
    html = html.replaceAll(token, value);
  }
  if (document.nativeState) {
    // Only this fixed, hash-authorized bootstrap runs. Let the browser restore
    // its own top layer and ::backdrop; do not approximate a dialog with cards
    // or a separately styled imitation. App scripts/events remain stripped.
    const hash = createHash("sha256").update(restoreNativeState).digest("base64");
    html = html.replace("script-src 'none'", `script-src 'sha256-${hash}'`).replace("</body>", `<script>${restoreNativeState}</script></body>`);
  }
  return html;
}
