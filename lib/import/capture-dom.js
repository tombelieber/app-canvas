// Runs in the selected browser document. Only rendered DOM/style facts leave
// this function; markup, scripts, hidden app state and input secrets do not.
export function readRenderedDocument(options) {
  const { properties, allowedHtml, allowedSvg, maxNodes, maxHeight } = options;
  let counter = 0; const issues = [], masks = [], families = new Set();
  const redact = value => String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]").replace(/\b(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{16,}/g, "[credential]").replace(/\bBearer\s+[A-Za-z0-9._-]{16,}/gi, "[credential]").replace(/(^|\s)@[A-Za-z0-9_.-]{2,}/g, "$1[account]");
  const path = el => { const parts = []; while (el && el !== document.documentElement) { parts.unshift(`${el.localName}:nth-child(${[...el.parentElement?.children || []].indexOf(el) + 1})`); el = el.parentElement; } return `html>${parts.join(">")}`; };
  const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  const styles = css => {
    const result = {};
    for (const property of properties) { const value = css.getPropertyValue(property); if (value) result[property] = value; }
    families.add(css.fontFamily); return result;
  };
  const visit = (source, privateParent = false, depth = 0) => {
    if (++counter > maxNodes || depth > 90) { if (!issues.includes("Document complexity limit")) issues.push("Document complexity limit"); return null; }
    const id = `n${counter}`;
    if (source.nodeType === Node.TEXT_NODE) {
      const original = source.textContent, value = privateParent ? (original.trim() ? "[identity]" : original) : redact(original);
      if (value !== original && source.parentElement?.isConnected && source.getRootNode() === document) masks.push(path(source.parentElement));
      return { id, text: value.slice(0, 100000) };
    }
    if (!(source instanceof Element) || ["SCRIPT", "STYLE", "LINK", "NOSCRIPT", "META", "BASE", "TEMPLATE"].includes(source.tagName)) return null;
    const css = getComputedStyle(source); if (css.display === "none") return null;
    const isSvg = source.namespaceURI === "http://www.w3.org/2000/svg", originalTag = source.localName;
    let tag = isSvg ? originalTag : originalTag.toLowerCase();
    const privateNode = privateParent || source.matches('[data-private],[data-canvas-private],input,textarea') || (source.matches('button,[role="button"]') && /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(source.textContent));
    const node = { id, tag, attrs: {}, style: styles(css), rect: rect(source), children: [] };
    if (source.matches("canvas,video,iframe,object,embed")) {
      node.tag = "div"; node.uneditable = true; node.style["background-color"] = "rgb(225, 230, 232)";
      node.children = [{ id: `n${++counter}`, text: "Captured region · read-only" }]; issues.push(`Read-only ${tag} region`); return node;
    }
    if (!(isSvg ? allowedSvg : allowedHtml).includes(tag)) { node.tag = "div"; if (!source.shadowRoot && !source.children.length) issues.push("Unsupported custom element"); }
    const svgAttrs = ["id", "viewBox", "preserveAspectRatio", "d", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "points", "fill", "stroke", "stroke-width", "fill-rule", "clip-rule", "clip-path", "mask", "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform", "patternUnits", "patternContentUnits", "patternTransform", "transform", "text-anchor", "dominant-baseline"];
    const htmlAttrs = ["role", "title", "aria-label", "placeholder", "rows", "cols", "min", "max", "step", "alt", "colspan", "rowspan"];
    for (const key of isSvg ? svgAttrs : htmlAttrs) if (source.hasAttribute(key)) node.attrs[key] = redact(source.getAttribute(key)).slice(0, 100000);
    if (source instanceof HTMLInputElement) { node.attrs.type = ["checkbox", "radio", "range", "number", "date", "time", "color"].includes(source.type) ? source.type : "text"; node.attrs.value = ""; if (source.checked) node.attrs.checked = ""; if (source.value) masks.push(path(source)); }
    if (source instanceof HTMLTextAreaElement && source.value) masks.push(path(source));
    if (source instanceof HTMLOptionElement && source.selected) node.attrs.selected = "";
    if (source instanceof HTMLDialogElement && source.open) { node.attrs.open = ""; node.nativeModal = source.matches(":modal"); }
    if (source.matches(":popover-open")) node.nativePopover = true;
    if (source instanceof HTMLImageElement) {
      if (privateNode || /avatar|profile|account|user photo/i.test(source.alt)) { node.tag = "div"; node.uneditable = true; node.style["background-color"] = "rgb(225, 230, 232)"; masks.push(path(source)); }
      else if (source.complete && source.naturalWidth) node.resource = source.currentSrc || source.src;
      else issues.push("Image was not loaded at capture");
    }
    if (isSvg && ["image", "use"].includes(tag)) {
      const href = source.getAttribute("href") || source.getAttribute("xlink:href");
      if (href?.startsWith("#")) node.attrs.href = href; else if (href && tag === "image") node.resource = new URL(href, document.baseURI).href;
    }
    const pseudo = kind => {
      if (isSvg || ["input", "img", "textarea", "select"].includes(tag)) return null;
      const style = getComputedStyle(source, `::${kind}`); if (["none", "normal", '""'].includes(style.content) || style.display === "none") return null;
      let value; try { value = JSON.parse(style.content); } catch { issues.push("Unsupported pseudo-element content"); return null; }
      return typeof value === "string" ? { id: `n${++counter}`, tag: "span", attrs: {}, style: styles(style), children: [{ id: `n${++counter}`, text: redact(value) }] } : null;
    };
    const before = pseudo("before"); if (before) node.children.push(before);
    const children = source instanceof HTMLTextAreaElement ? [] : source.localName === "slot" && source.assignedNodes?.().length ? source.assignedNodes() : source.shadowRoot ? source.shadowRoot.childNodes : source.childNodes;
    for (const child of children) { const next = visit(child, privateNode, depth + 1); if (next) node.children.push(next); }
    const after = pseudo("after"); if (after) node.children.push(after);
    return node;
  };
  const root = visit(document.body);
  const height = Math.max(innerHeight, Math.min(maxHeight, document.documentElement.scrollHeight));
  if (document.documentElement.scrollHeight > maxHeight) issues.push("Long page height limit; capture more content separately");
  return { root, height, viewport: { width: innerWidth, height: innerHeight }, issues: [...new Set(issues)], masks: [...new Set(masks)], families: [...families], baseUrl: document.baseURI, title: document.querySelector("main h1,h1")?.textContent?.trim() || document.title, scroll: { x: scrollX, y: scrollY } };
}
