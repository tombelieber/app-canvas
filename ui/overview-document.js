// This fixed renderer runs in ONE opaque-origin sandbox. Source app scripts
// never run here. Shadow trees isolate each source document's selectors/IDs;
// original running apps remain separate, bounded LiveFrames.
function renderOverview() {
  const world = document.getElementById("world"), documents = new Map(), fonts = new Set();
  let token, layout = [], lowDetail = true, detailTimer;
  const detail = reduced => {
    if (reduced === lowDetail) return;
    lowDetail = reduced;
    for (const host of documents.values()) host.dataset.lowDetail = String(reduced);
  };
  const place = () => {
    for (const item of layout) {
      const host = documents.get(item.id);
      if (!host) continue;
      host.dataset.lowDetail = String(lowDetail);
      host.hidden = !item.visible;
      host.dataset.visible = String(item.visible);
      Object.assign(host.style, { left: `${item.x}px`, top: `${item.y + 4}px`, width: `${item.width}px`, height: `${item.height}px`, transform: `scale(${390 / item.width})` });
    }
  };
  window.addEventListener("message", event => {
    if (event.source !== parent || event.data?.channel !== "app-canvas-overview") return;
    const message = event.data;
    if (token && token !== message.token) return;
    token = message.token;
    if (message.command === "clear") {
      clearTimeout(detailTimer); lowDetail = true;
      world.replaceChildren(); documents.clear();
      document.querySelectorAll("style[data-font]").forEach(el => el.remove()); fonts.clear();
    }
    if (message.command === "camera") {
      const { x, y, zoom } = message.viewport;
      world.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
      // Preserve source layout: CSS zoom reflows native controls differently
      // across engines. Only defer backdrop effects while moving or tiny.
      clearTimeout(detailTimer); detail(true);
      if (zoom * 390 >= 120) detailTimer = setTimeout(() => detail(false), 150);
    }
    if (message.command === "layout") { layout = message.items; place(); }
    if (message.command === "document") {
      const parsed = new DOMParser().parseFromString(message.document.html, "text/html");
      // Defense in depth for older capture documents. Only the renderer's own
      // nonce-authorized script may execute; the CSP also blocks connections.
      parsed.querySelectorAll("script,meta,base,link,iframe,object,embed").forEach(el => el.remove());
      for (const el of parsed.querySelectorAll("*")) for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      if (!fonts.has(message.document.fonts)) {
        const style = document.createElement("style"); style.dataset.font = ""; style.textContent = message.document.fonts; document.head.append(style); fonts.add(message.document.fonts);
      }
      const host = document.createElement("div");
      host.dataset.preview = message.id; host.hidden = true;
      host.style.background = message.document.background;
      const shadow = host.attachShadow({ mode: "open" });
      const reset = document.createElement("style");
      reset.textContent = ":host{all:initial;display:block}*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}:host([data-low-detail=true]) *,:host([data-low-detail=true]) *::before,:host([data-low-detail=true]) *::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}html{min-height:100%;overflow:hidden}";
      shadow.append(reset, document.importNode(parsed.documentElement, true));
      documents.get(message.id)?.remove(); documents.set(message.id, host); world.append(host); place();
      Promise.all([...shadow.querySelectorAll("img")].map(img => img.decode().catch(() => {}))).then(async () => {
        await document.fonts.ready;
        if (!host.isConnected) return;
        host.dataset.ready = "true";
        parent.postMessage({ channel: "app-canvas-overview", token, ready: message.id }, "*");
      });
    }
  });
}

export function overviewDocument(nonce) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}#world{position:absolute;left:0;top:0;transform-origin:0 0}#world>div{position:absolute;transform-origin:0 0;contain:layout style paint;overflow:hidden;pointer-events:none}#world>div[hidden]{display:none}</style></head><body><div id="world"></div><script nonce="${nonce}">(${renderOverview.toString()})()</script></body></html>`;
}
