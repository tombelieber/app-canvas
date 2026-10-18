// This is the only executable script in an imported document. It operates on
// sanitized layers and reports local edits; it never runs website handlers.
export function editorRuntime(token, prototype = false, links = []) {
  const channel = "app-canvas-import-editor", send = value => parent.postMessage({ channel, token, ...value }, "*");
  let selected, drag;
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
    let matrix = new DOMMatrix();
    for (let ancestor = includeSelf ? el : el.parentElement; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
      const css = getComputedStyle(ancestor); if (css.transform !== "none") matrix = new DOMMatrix(css.transform).multiply(matrix);
    }
    try { const result = matrix.inverse().transformPoint(new DOMPoint(dx, dy, 0, 0)); return { x: result.x, y: result.y }; } catch { return { x: dx, y: dy }; }
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
    if (prototype || e.button !== 0) return;
    const resize = e.target === handle, el = resize ? selected : e.target.closest("[data-canvas-layer]");
    if (!el || el.dataset.canvasReadonly) return;
    e.preventDefault(); e.stopPropagation(); select(el);
    const r = bounds(el);
    drag = { el, resize, x: e.clientX, y: e.clientY, width: r.width, height: r.height, offsetX: Number(el.dataset.canvasOffsetX || 0), offsetY: Number(el.dataset.canvasOffsetY || 0), moved: false };
    el.setPointerCapture?.(e.pointerId);
  }, true);
  document.addEventListener("pointermove", e => {
    if (!drag) return;
    const d = vector(drag.el, e.clientX - drag.x, e.clientY - drag.y, drag.resize); if (Math.hypot(d.x, d.y) < 2 && !drag.moved) return; drag.moved = true;
    if (drag.resize) { drag.next = { type: "resize", layerId: drag.el.dataset.canvasLayer, width: Math.max(1, drag.width + d.x), height: Math.max(1, drag.height + d.y) }; Object.assign(drag.el.style, { width: `${drag.next.width}px`, height: `${drag.next.height}px`, flexShrink: "0", boxSizing: "border-box", display: drag.el.hasAttribute("data-canvas-text") ? "inline-block" : drag.el.style.display }); }
    else { drag.next = { type: "move", layerId: drag.el.dataset.canvasLayer, x: drag.offsetX + d.x, y: drag.offsetY + d.y }; drag.el.style.translate = `${drag.next.x}px ${drag.next.y}px`; }
    show();
  }, true);
  document.addEventListener("pointerup", () => { if (drag?.next) send({ type: "operation", operation: drag.next }); drag = undefined; }, true);
  window.addEventListener("scroll", show, true); window.addEventListener("resize", show);
  window.addEventListener("message", e => {
    if (e.source !== parent || e.data?.channel !== channel || e.data.token !== token) return;
    if (e.data.type === "select" && typeof e.data.layerId === "string" && /^[a-zA-Z0-9_-]+$/.test(e.data.layerId)) { selected = document.querySelector(`[data-canvas-layer="${e.data.layerId}"]`); show(); }
    if (e.data.type === "render" && typeof e.data.html === "string" && e.data.html.length <= 45000000) {
      const previousScroll = { x: scrollX, y: scrollY }, selectedId = e.data.selected || selected?.dataset.canvasLayer;
      const parsed = new DOMParser().parseFromString(e.data.html, "text/html");
      parsed.querySelectorAll("script,base,link,iframe,object,embed").forEach(el => el.remove());
      for (const el of parsed.querySelectorAll("*")) for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      document.head.querySelectorAll("style").forEach(el => el.remove()); parsed.head.querySelectorAll("style").forEach(el => document.head.append(document.importNode(el, true)));
      for (const attr of [...document.body.attributes]) document.body.removeAttribute(attr.name);
      for (const attr of [...parsed.body.attributes]) document.body.setAttribute(attr.name, attr.value);
      document.body.replaceChildren(...[...parsed.body.childNodes].map(el => document.importNode(el, true)), outline);
      links = Array.isArray(e.data.links) ? e.data.links : [];
      selected = selectedId && /^[a-zA-Z0-9_-]+$/.test(selectedId) ? document.querySelector(`[data-canvas-layer="${selectedId}"]`) : null;
      scrollTo(previousScroll.x, previousScroll.y); show();
      send({ type: "rendered", revision: e.data.revision });
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") send({ type: "browse" }); }, true);
  send({ type: "ready" });
}
