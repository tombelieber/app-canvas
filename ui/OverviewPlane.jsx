import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ViewportPortal } from "@xyflow/react";

export function OverviewPlane({ nodes, viewport, area, previews, mounted, revision, onError }) {
  const frame = useRef(null), latest = useRef(null), jobs = useRef(null), [loaded, setLoaded] = useState(0);
  const nonce = useMemo(() => crypto.randomUUID(), []);
  const source = useMemo(() => new URL(`./overview.html?runtime=${nonce}`, import.meta.url).href, [nonce]);
  const send = useCallback(message => frame.current?.contentWindow?.postMessage({ channel: "app-canvas-overview", token: nonce, ...message }, "*"), [nonce]);
  const sources = useMemo(() => nodes.filter(n => n.type === "screen" && n.data.sharedUrl).map(n => ({ id: n.id, url: n.data.sharedUrl })), [nodes]);
  const sourceKey = JSON.stringify(sources);
  const layout = nodes.filter(n => n.type === "screen" && n.data.sharedUrl).map(n => ({ id: n.id, x: n.position.x, y: n.position.y, width: n.data.viewport.width, height: n.data.viewport.height, visible: previews.has(n.id) && !mounted.has(n.id) }));
  latest.current = { viewport, layout };
  useEffect(() => { if (loaded) send({ command: "camera", viewport }); }, [loaded, viewport, send]);
  useEffect(() => { if (loaded) send({ command: "layout", items: layout }); }, [loaded, nodes, previews, mounted, send]);
  useEffect(() => {
    if (!loaded) return;
    const controller = new AbortController();
    jobs.current = { controller, keys: new Map(), queue: [], active: 0 };
    frame.current.removeAttribute("data-error"); onError({});
    send({ command: "clear" });
    send({ command: "camera", viewport: latest.current.viewport });
    send({ command: "layout", items: latest.current.layout });
    return () => controller.abort();
  }, [loaded, revision, send, onError]);
  useEffect(() => {
    const batch = jobs.current;
    if (!loaded || !batch || batch.controller.signal.aborted) return;
    // Bounded IO; keep inert DOM trees through zooms instead of repeatedly
    // destroying/recreating 77 browsing contexts and their backing surfaces.
    // A growing build manifest only adds new work; it never reloads the cases
    // already captured in the same revision.
    for (const source of JSON.parse(sourceKey)) if (batch.keys.get(source.id) !== source.url) { batch.keys.set(source.id, source.url); batch.queue.push(source); }
    const load = async () => {
      batch.active++;
      while (batch.queue.length && !batch.controller.signal.aborted) {
        const source = batch.queue.shift();
        try {
          const url = new URL(source.url, location.href); url.searchParams.set("__canvas_revision", revision);
          const response = await fetch(url, { signal: batch.controller.signal });
          if (!response.ok) throw Error("Preview unavailable");
          const document = await response.json();
          if (!batch.controller.signal.aborted) send({ command: "document", id: source.id, document });
        } catch (error) {
          if (!batch.controller.signal.aborted) { frame.current.dataset.error = source.id; onError(old => ({ ...old, [source.id]: "預覽未能載入；點選畫面可開啟原 App。" })); }
        }
      }
      batch.active--;
    };
    const available = Math.min(4 - batch.active, batch.queue.length);
    for (let i = 0; i < available; i++) load();
  }, [loaded, sourceKey, revision, send, onError]);
  // Counter the graph transform so the single iframe ALWAYS has a physical
  // viewport-sized surface, even at 500% zoom. Its DOM world follows the camera.
  return <ViewportPortal><div className="overview-plane" style={{ width: area.width, height: area.height, transform: `translate(${-viewport.x / viewport.zoom}px, ${-viewport.y / viewport.zoom}px) scale(${1 / viewport.zoom})` }}>
    <iframe ref={frame} data-overview title="所有完整 UI · 共用隔離渲染" src={source} sandbox="allow-scripts" inert tabIndex={-1} onLoad={() => setLoaded(old => old + 1)} />
  </div></ViewportPortal>;
}
