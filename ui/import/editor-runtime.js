// This is the only executable script in an imported document. It operates on
// sanitized layers and reports local edits; it never runs website handlers.
export function editorRuntime(token, prototype = false, links = []) {
  const channel = "app-canvas-import-editor", send = value => parent.postMessage({ channel, token, ...value }, "*");
  let selected, drag, pending = false, initialized = false, revision = 0;
  document.documentElement.dataset.importReady = "false";
  const outline = document.createElement("div"); outline.dataset.editorOverlay = "";
  Object.assign(outline.style, { position: "fixed", border: "2px solid #2684ff", pointerEvents: "none", zIndex: "2147483647", boxSizing: "border-box", display: "none" });
  const handle = document.createElement("div"); handle.dataset.editorResize = "";
  Object.assign(handle.style, { position: "absolute", width: "12px", height: "12px", right: "-6px", bottom: "-6px", background: "white", border: "2px solid #2684ff", pointerEvents: "auto", cursor: "nwse-resize" });
  outline.append(handle); document.body.append(outline);
  const bounds = el => {
    if (!el.hasAttribute("data-canvas-text")) return el.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(el); return range.getBoundingClientRect();
  };
  const show = () => { if (!selected?.isConnected || prototype) { outline.style.display = "none"; return; } const r = bounds(selected); Object.assign(outline.style, { display: "block", left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` }); };
  const select = el => { selected = el; show(); if (el) send({ type: "select", layerId: el.dataset.canvasLayer }); };
  const vector = (el, dx, dy, includeSelf) => {
    if (el.ownerSVGElement) { try { const matrix = (includeSelf ? el : el.parentElement).getScreenCTM(); const point = matrix.inverse().transformPoint(new DOMPoint(dx, dy, 0, 0)); return { x: point.x, y: point.y }; } catch { /* regular CSS matrix path */ } }
    let matrix = new DOMMatrix();
    for (let ancestor = includeSelf ? el : el.parentElement; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
      const css = getComputedStyle(ancestor), local = new DOMMatrix();
      if (css.rotate && css.rotate !== "none") local.rotateSelf(parseFloat(css.rotate));
      if (css.scale && css.scale !== "none") { const values = css.scale.split(" ").map(Number); local.scaleSelf(values[0], values[1] ?? values[0]); }
      matrix = local.multiply(css.transform === "none" ? new DOMMatrix() : new DOMMatrix(css.transform)).multiply(matrix);
    }
    try { const result = matrix.inverse().transformPoint(new DOMPoint(dx, dy, 0, 0)); return { x: result.x, y: result.y }; } catch { return { x: dx, y: dy }; }
  };
  const translate = (base, x, y) => {
    const values = []; let depth = 0, start = 0;
    for (let i = 0; i <= base.length; i++) { if (base[i] === "(") depth++; if (base[i] === ")") depth--; if (i === base.length || /\s/.test(base[i]) && !depth) { if (i > start) values.push(base.slice(start, i)); start = i + 1; } }
    if (values[0] === "none") values.length = 0;
    return `calc(${values[0] || "0px"} + ${x}px) calc(${values[1] || "0px"} + ${y}px)${values[2] ? ` ${values[2]}` : ""}`;
  };
  document.addEventListener("submit", e => e.preventDefault(), true);
  document.addEventListener("click", e => {
    e.preventDefault(); e.stopPropagation();
    if (prototype) {
      const control = e.target.closest("button,a,[role=menuitem],[role=option],[role=tab]");
      if (!control) return;
      const label = (control.getAttribute("aria-label") || control.getAttribute("title") || control.innerText || "").trim();
      const matching = links.filter(link => link.label === label); if (matching.length === 1) send({ type: "navigate", to: matching[0].to });
    }
  }, true);
  document.addEventListener("pointerdown", e => {
    if (prototype || pending || e.button !== 0) return;
    const resize = e.target === handle, el = resize ? selected : e.target.closest("[data-canvas-layer]");
    if (!el || el.dataset.canvasReadonly) return;
    e.preventDefault(); e.stopPropagation(); select(el);
    if (resize && el.hasAttribute("data-canvas-text")) el.style.display = "inline-block";
    const r = bounds(el);
    const css = getComputedStyle(el);
    drag = { el, resize, revision, x: e.clientX, y: e.clientY, width: el.offsetWidth || parseFloat(css.width) || r.width, height: el.offsetHeight || parseFloat(css.height) || r.height, offsetX: Number(el.dataset.canvasOffsetX || 0), offsetY: Number(el.dataset.canvasOffsetY || 0), baseTranslate: el.dataset.canvasBaseTranslate || "none", moved: false };
    el.setPointerCapture?.(e.pointerId);
  }, true);
  document.addEventListener("pointermove", e => {
    if (!drag) return;
    const d = vector(drag.el, e.clientX - drag.x, e.clientY - drag.y, drag.resize); if (Math.hypot(d.x, d.y) < 2 && !drag.moved) return; drag.moved = true;
    if (drag.resize) { drag.next = { type: "resize", layerId: drag.el.dataset.canvasLayer, width: Math.max(1, drag.width + d.x), height: Math.max(1, drag.height + d.y) }; Object.assign(drag.el.style, { width: `${drag.next.width}px`, height: `${drag.next.height}px`, flexShrink: "0", boxSizing: "border-box", display: drag.el.hasAttribute("data-canvas-text") ? "inline-block" : drag.el.style.display }); }
    else { drag.next = { type: "move", layerId: drag.el.dataset.canvasLayer, x: drag.offsetX + d.x, y: drag.offsetY + d.y }; drag.el.style.translate = translate(drag.baseTranslate, drag.next.x, drag.next.y); }
    show();
  }, true);
  document.addEventListener("pointerup", () => { if (drag?.next) { pending = true; document.documentElement.dataset.importReady = "false"; send({ type: "pending" }); send({ type: "operation", revision: drag.revision, operation: drag.next }); } drag = undefined; }, true);
  window.addEventListener("scroll", show, true); window.addEventListener("resize", show);
  window.addEventListener("message", e => {
    if (e.source !== parent || e.data?.channel !== channel || e.data.token !== token) return;
    if (e.data.type === "select" && typeof e.data.layerId === "string" && /^[a-zA-Z0-9_-]+$/.test(e.data.layerId)) { selected = document.querySelector(`[data-canvas-layer="${e.data.layerId}"]`); show(); }
    if (e.data.type === "render" && typeof e.data.html === "string" && e.data.html.length <= 45000000) {
      document.documentElement.dataset.importReady = "false";
      const innerScroll = new Map([...document.querySelectorAll("[data-canvas-layer]")].filter(el => el.scrollTop || el.scrollLeft).map(el => [el.dataset.canvasLayer, { x: el.scrollLeft, y: el.scrollTop }]));
      const previousScroll = initialized ? { x: scrollX, y: scrollY } : null, selectedId = e.data.selected || selected?.dataset.canvasLayer;
      const parsed = new DOMParser().parseFromString(e.data.html, "text/html");
      parsed.querySelectorAll("script,base,link,iframe,object,embed").forEach(el => el.remove());
      for (const el of parsed.querySelectorAll("*")) for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      document.head.querySelectorAll("style").forEach(el => el.remove()); parsed.head.querySelectorAll("style").forEach(el => document.head.append(document.importNode(el, true)));
      for (const attr of [...document.body.attributes]) document.body.removeAttribute(attr.name);
      for (const attr of [...parsed.body.attributes]) document.body.setAttribute(attr.name, attr.value);
      document.body.replaceChildren(...[...parsed.body.childNodes].map(el => document.importNode(el, true)), outline);
      revision = e.data.revision;
      links = Array.isArray(e.data.links) ? e.data.links : [];
      selected = selectedId && /^[a-zA-Z0-9_-]+$/.test(selectedId) ? document.querySelector(`[data-canvas-layer="${selectedId}"]`) : null;
      for (const el of document.querySelectorAll("[data-canvas-scroll-y],[data-canvas-layer]")) {
        const position = innerScroll.get(el.dataset.canvasLayer) || { x: Number(el.dataset.canvasScrollX || 0), y: Number(el.dataset.canvasScrollY || 0) };
        el.scrollLeft = position.x; el.scrollTop = position.y;
      }
      const position = previousScroll || { x: Number(parsed.documentElement.dataset.canvasScrollX || 0), y: Number(parsed.documentElement.dataset.canvasScrollY || 0) };
      scrollTo(position.x, position.y); initialized = true; show(); pending = false; drag = undefined; document.documentElement.dataset.importReady = "true";
      send({ type: "rendered", revision: e.data.revision });
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") send({ type: "browse" }); }, true);
  send({ type: "ready" });
}
