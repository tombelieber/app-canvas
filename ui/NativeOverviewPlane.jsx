import { useI18n } from "./i18n.jsx";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createNativeRenderer, loadNativeAtlas } from "./native-atlas.js";

export function NativeOverviewPlane({ atlas, nodes, viewport, area, mounted, liveScreen, onReady, error }) {
  const { t } = useI18n();
  const canvas = useRef(null), latest = useRef(null), draw = useRef(null);
  const [state, setState] = useState({ atlas: null, status: "loading" });
  const status = state.atlas === atlas ? state.status : "loading";
  latest.current = { nodes, viewport, area, mounted, liveScreen };
  useEffect(() => {
    if (!atlas) { onReady(null, "none"); return; }
    let closed = false, image, gpu;
    const controller = new AbortController(), element = canvas.current;
    const fallback = () => { if (!closed) { setState({ atlas, status: "fallback" }); onReady(atlas, "fallback"); } };
    const paint = () => {
      if (!gpu || closed) return;
      const { nodes, viewport, area, mounted, liveScreen } = latest.current;
      const rectangles = new Map(atlas.cases.map(c => [c.id, c]));
      const items = nodes.filter(n => n.type === "screen" && n.data.visible && !n.data.error && rectangles.has(n.id) && !mounted.has(n.id) && n.id !== liveScreen)
        .map(node => ({ node, rect: rectangles.get(node.id) }));
      element.parentElement.dataset.drawn = String(gpu.draw(items, viewport, area));
      element.parentElement.dataset.camera = JSON.stringify(viewport);
    };
    draw.current = paint;
    const lost = event => { event.preventDefault(); controller.abort(); image?.close(); image = null; gpu = null; fallback(); };
    element.addEventListener("webglcontextlost", lost);
    setState({ atlas, status: "loading" }); onReady(atlas, "loading");
    (async () => {
      try {
        gpu = createNativeRenderer(element, atlas);
        image = await loadNativeAtlas(atlas, controller.signal);
        if (closed || !gpu) { image.close(); image = null; return; }
        gpu.upload(image); image.close(); image = null;
        paint(); setState({ atlas, status: "ready" }); onReady(atlas, "ready");
      } catch { image?.close(); image = null; gpu?.dispose(); gpu = null; fallback(); }
    })();
    return () => {
      closed = true; controller.abort(); element.removeEventListener("webglcontextlost", lost);
      image?.close(); gpu?.dispose(); draw.current = null;
    };
  }, [atlas, onReady]);
  // Commit with the same camera as React Flow; an extra RAF would leave images
  // one frame behind the DOM labels, handles and clickable flow connections.
  useLayoutEffect(() => { draw.current?.(); }, [nodes, viewport, area, mounted, liveScreen, status]);
  if (!atlas && !error) return null;
  return <div className="native-overview overview-plane" data-status={error ? "fallback" : status} data-drawn="0" style={{ width: area.width, height: area.height }}>
    {atlas && <canvas ref={canvas} style={{ width: "100%", height: "100%", visibility: status === "ready" ? "visible" : "hidden" }} aria-hidden="true" />}
    {(error || status === "fallback") && <span className="native-overview-notice" role="status">{t("Native acceleration unavailable; using original previews.")}</span>}
  </div>;
}
