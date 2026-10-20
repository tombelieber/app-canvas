// Runs in the selected browser document. Only rendered DOM/style facts leave
// this function; markup, scripts, hidden app state and input secrets do not.
export function readRenderedDocument(options) {
  const { properties, allowedHtml, allowedSvg, maxNodes, maxHeight } = options;
  const baseUrl = document.baseURI || document.URL || location.href;
  const redacted = options.redacted === true, safeLabels = new Set(options.allowText || []);
  const credentialRoute = /\/(?:auth|login|sign[-_]?in|sign[-_]?up|register|oauth|api[-_]?keys?|access[-_]?tokens?|credentials|password|secrets?)(?:\/|$)/i.test(location.pathname);
  const secretInput = [...document.querySelectorAll('input[type="password"],input[autocomplete="one-time-code"]')].some(el => { const r = el.getBoundingClientRect(); return r.width && r.height && getComputedStyle(el).visibility !== "hidden"; });
  if (secretInput || credentialRoute && !redacted) return { paused: true, reason: "Private authentication or credential surface" };
  let counter = 0, characters = 0, headingTitle; const issues = [], masks = [], families = new Set();
  const bounded = value => { characters += value.length; if (characters > options.maxCharacters) throw Error("Rendered document exceeds transport budget"); return value; };
  const redact = value => String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]").replace(/\b(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{16,}/g, "[credential]").replace(/\bBearer\s+[A-Za-z0-9._-]{16,}/gi, "[credential]").replace(/(^|\s)@[A-Za-z0-9_.-]{2,}/g, "$1[account]");
  const visibleText = value => redacted && value.trim() && !safeLabels.has(value.trim()) ? "[redacted]" : redact(value);
  const path = el => { const parts = []; while (el && el !== document.documentElement) { parts.unshift(`${el.localName}:nth-child(${[...el.parentElement?.children || []].indexOf(el) + 1})`); el = el.parentElement; } return `html>${parts.join(">")}`; };
  const maskPath = el => { while (el.getRootNode().host) el = el.getRootNode().host; return path(el); };
  const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  const styles = css => {
    const result = {};
    for (const property of properties) { const value = css.getPropertyValue(property); if (value) result[property] = bounded(redacted && /url\s*\(/i.test(value) ? "none" : value); }
    families.add(css.fontFamily); return result;
  };
  const visit = (source, privateParent = false, depth = 0) => {
    if (++counter > maxNodes || depth > 90) { if (!issues.includes("Document complexity limit")) issues.push("Document complexity limit"); return null; }
    const id = `n${counter}`;
    if (source.nodeType === 3) {
      const original = source.textContent, value = privateParent ? (original.trim() ? "[identity]" : original) : visibleText(original);
      if (value !== original && source.parentElement?.isConnected) masks.push(maskPath(source.parentElement));
      return { id, text: bounded(value.slice(0, 100000)) };
    }
    if (source.nodeType !== 1 || ["SCRIPT", "STYLE", "LINK", "NOSCRIPT", "META", "BASE", "TEMPLATE"].includes(source.tagName)) return null;
    const css = getComputedStyle(source); if (css.display === "none" || ["hidden", "collapse"].includes(css.visibility) || css.opacity === "0" || css.contentVisibility === "hidden") return null;
    const isSvg = source.namespaceURI === "http://www.w3.org/2000/svg", originalTag = source.localName;
    let tag = isSvg ? originalTag : originalTag.toLowerCase();
    const privateNode = privateParent || source.matches('[data-private],[data-canvas-private],input,textarea') || (source.matches('button,[role="button"]') && /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(source.textContent));
    const node = { id, tag, attrs: {}, style: styles(css), rect: rect(source), children: [] };
    if (source !== document.body && (source.scrollLeft || source.scrollTop)) node.scroll = { x: source.scrollLeft, y: source.scrollTop };
    if (source.matches("canvas,video,iframe,object,embed")) {
      node.tag = "div"; node.uneditable = true; node.style["background-color"] = "rgb(225, 230, 232)";
      node.children = [{ id: `n${++counter}`, text: "Captured region · read-only" }]; issues.push(`Read-only ${tag} region`); return node;
    }
    if (!(isSvg ? allowedSvg : allowedHtml).includes(tag)) { node.tag = isSvg ? "g" : "div"; if (isSvg || !source.shadowRoot && !source.children.length) issues.push(isSvg ? "Unsupported SVG element" : "Unsupported custom element"); }
    const svgAttrs = ["id", "viewBox", "preserveAspectRatio", "d", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "points", "fill", "stroke", "stroke-width", "fill-rule", "clip-rule", "clip-path", "mask", "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform", "patternUnits", "patternContentUnits", "patternTransform", "transform", "text-anchor", "dominant-baseline"];
    const htmlAttrs = ["role", "title", "aria-label", "placeholder", "rows", "cols", "min", "max", "step", "alt", "colspan", "rowspan"];
    for (const key of isSvg ? svgAttrs : htmlAttrs) if (source.hasAttribute(key)) {
      if (redacted && isSvg && ["id", "clip-path", "mask"].includes(key)) continue;
      const value = source.getAttribute(key);
      node.attrs[key] = (redacted && /url\s*\(/i.test(value) ? "none" : ["title", "aria-label", "placeholder", "alt"].includes(key) ? visibleText(value) : redact(value)).slice(0, 100000);
    }
    if (source.localName === "input") { node.attrs.type = ["checkbox", "radio", "range", "number", "date", "time", "color"].includes(source.type) ? source.type : "text"; node.attrs.value = ""; if (source.checked) node.attrs.checked = ""; if (source.value) masks.push(maskPath(source)); }
    if (source.localName === "textarea" && source.value) masks.push(maskPath(source));
    if (source.localName === "option" && source.selected) node.attrs.selected = "";
    if (source.localName === "dialog" && source.open) { node.attrs.open = ""; if (source.matches(":modal")) issues.push("Native modal top-layer appearance requires review"); }
    if (source.matches(":popover-open")) issues.push("Native popover top-layer appearance requires review");
    if (source.localName === "img") {
      if (redacted || privateNode || /avatar|profile|account|user photo/i.test(source.alt)) { node.tag = "div"; node.uneditable = true; node.style["background-color"] = "rgb(225, 230, 232)"; masks.push(maskPath(source)); }
      else if (source.complete && source.naturalWidth) node.resource = source.currentSrc || source.src;
      else issues.push("Image was not loaded at capture");
    }
    if (!redacted && isSvg && ["image", "use"].includes(tag)) {
      const href = source.getAttribute("href") || source.getAttribute("xlink:href");
      if (href?.startsWith("#")) node.attrs.href = href; else if (href && tag === "image") node.resource = new URL(href, baseUrl).href;
    }
    const pseudo = kind => {
      if (isSvg || ["input", "img", "textarea", "select"].includes(tag)) return null;
      const style = getComputedStyle(source, `::${kind}`); if (["none", "normal", '""'].includes(style.content) || style.display === "none") return null;
      let value; try { value = JSON.parse(style.content); } catch { issues.push("Unsupported pseudo-element content"); return null; }
      return typeof value === "string" ? { id: `n${++counter}`, tag: "span", attrs: {}, style: styles(style), children: [{ id: `n${++counter}`, text: visibleText(value) }] } : null;
    };
    const before = pseudo("before"); if (before) node.children.push(before);
    const children = source.localName === "textarea" ? [] : source.localName === "slot" && source.assignedNodes?.().length ? source.assignedNodes() : source.shadowRoot ? source.shadowRoot.childNodes : source.childNodes;
    for (const child of children) { const next = visit(child, privateNode, depth + 1); if (next) node.children.push(next); }
    const after = pseudo("after"); if (after) node.children.push(after);
    if (tag === "h1" && headingTitle === undefined) {
      const content = layer => layer.text ?? (layer.children || []).map(content).join("");
      headingTitle = content(node).trim();
    }
    return node;
  };
  const root = visit(document.body);
  const embeddedStyles = [], seenSheets = new Set();
  const collectFonts = sheet => {
    if (seenSheets.has(sheet)) return; seenSheets.add(sheet);
    try {
      const visitRules = rules => { for (const rule of rules) { if (rule.type === 5) embeddedStyles.push([sheet.href || baseUrl, bounded(rule.cssText)]); else if (rule.cssRules) visitRules(rule.cssRules); } };
      visitRules(sheet.cssRules);
    } catch { /* cross-origin stylesheet bodies are collected by the driver */ }
  };
  if (!redacted) for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) collectFonts(sheet);
  if (redacted) issues.push("Allowlisted text capture; images and external resources excluded");
  const height = Math.max(innerHeight, Math.min(maxHeight, document.documentElement.scrollHeight));
  if (document.documentElement.scrollHeight > maxHeight) issues.push("Long page height limit; capture more content separately");
  return { root, height, viewport: { width: innerWidth, height: innerHeight }, issues: [...new Set(issues)], masks: [...new Set(masks)], families: [...families], embeddedStyles, baseUrl, title: visibleText(headingTitle || document.title), scroll: { x: scrollX, y: scrollY } };
}
