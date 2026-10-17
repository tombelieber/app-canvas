import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useViewport } from "@xyflow/react";
import { createOverviewLoader, OVERVIEW_LIMIT } from "./overview-loader.js";

export function OverviewPlane({ nodes, area, previews, mounted, liveScreen, revision, onError }) {
  const viewport = useViewport();
  const frame = useRef(null), latest = useRef(null), jobs = useRef(null), [loaded, setLoaded] = useState(0);
  const nonce = useMemo(() => crypto.randomUUID(), []);
  const source = useMemo(() => new URL(`./overview.html?runtime=${nonce}`, import.meta.url).href, [nonce]);
  const send = useCallback(message => frame.current?.contentWindow?.postMessage({ channel: "app-canvas-overview", token: nonce, ...message }, "*"), [nonce]);
  const sources = useMemo(() => nodes.filter(n => n.type === "screen" && n.data.sharedUrl).map(n => ({ id: n.id, url: n.data.sharedUrl })), [nodes]);
  const sourceKey = useMemo(() => JSON.stringify(sources.length <= OVERVIEW_LIMIT ? sources : sources.filter(source => previews.has(source.id) && !mounted.has(source.id))), [sources, previews, mounted]);
  const layout = useMemo(() => nodes.filter(n => n.type === "screen" && n.data.sharedUrl).map(n => ({ id: n.id, x: n.position.x, y: n.position.y, width: n.data.viewport.width, height: n.data.viewport.height, visible: previews.has(n.id) && !mounted.has(n.id) && n.id !== liveScreen })), [nodes, previews, mounted, liveScreen]);
  latest.current = { viewport, layout };
  useEffect(() => {
    if (!loaded) return;
    // Culling and camera movement are one transaction: WebKit must not paint
    // the previous visible set at the new, potentially much larger scale.
    send({ command: "camera", viewport, items: layout });
  }, [loaded, viewport, layout, send]);
  useEffect(() => {
    if (!loaded) return;
    const loader = createOverviewLoader({
      async load(source, signal) {
        const url = new URL(source.url, location.href); url.searchParams.set("__canvas_revision", revision);
        const response = await fetch(url, { signal });
        if (!response.ok) throw Error("Preview unavailable");
        return response.json();
      },
      show(source, document) {
        if (frame.current?.dataset.error === source.id) frame.current.removeAttribute("data-error");
        onError(old => { if (!old[source.id]) return old; const next = { ...old }; delete next[source.id]; return next; });
        send({ command: "document", id: source.id, document });
      },
      evict(id) { send({ command: "evict", id }); },
      error(source) {
        frame.current.dataset.error = source.id;
        onError(old => ({ ...old, [source.id]: "預覽未能載入；點選畫面可開啟原 App。" }));
      },
    });
    jobs.current = loader;
    frame.current.removeAttribute("data-error"); onError({});
    send({ command: "clear" });
    send({ command: "camera", viewport: latest.current.viewport, items: latest.current.layout });
    return () => loader.close();
  }, [loaded, revision, send, onError]);
  useEffect(() => {
    if (loaded) jobs.current?.sync(JSON.parse(sourceKey));
  }, [loaded, sourceKey, revision]);
  // Keep the iframe outside the transformed graph. An inverse scale produces
  // small final bounds but can still allocate large intermediate WebKit layers.
  return <div className="overview-plane" style={{ width: area.width, height: area.height }}>
    <iframe ref={frame} data-overview title="所有完整 UI · 共用隔離渲染" src={source} sandbox="allow-scripts" inert tabIndex={-1} onLoad={() => setLoaded(old => old + 1)} />
  </div>;
}

export function ZoomLabel() {
  const { zoom } = useViewport();
  return <div className="zoom-label">{Math.round(zoom * 100)}%</div>;
}
