import React, { useCallback, useEffect, useMemo } from "react";
export function LiveFrame({ id, url, viewport, epoch, runId, interactive, bridge, title, presentation = false }) {
  const source = useMemo(() => {
    if (!url) return "about:blank";
    const next = new URL(url, location.href); next.searchParams.set("__canvas_epoch", epoch); return next.href;
  }, [url, epoch]);
  const ref = useCallback((element) => bridge.register(id, element, source), [id, source, bridge.register]);
  useEffect(() => { bridge.send(id, { type: "interact", value: interactive, presentation }); }, [id, interactive, presentation, source, bridge.send]);
  return <iframe ref={ref} data-screen={id} title={title} name={`app-canvas:${runId}:${id}`} src={source}
    style={{ width: viewport.width, height: viewport.height, transform: `scale(${390 / viewport.width})`, transformOrigin: "top left", pointerEvents: interactive ? "auto" : "none" }}
    tabIndex={interactive ? 0 : -1} sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"
    onLoad={() => { bridge.send(id, { type: "interact", value: interactive, presentation }); bridge.send(id, { type: "inspect" }); }} />;
}
