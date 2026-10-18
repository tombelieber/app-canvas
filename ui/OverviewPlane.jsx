import { useI18n } from "./i18n.jsx";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createOverviewLoader, OVERVIEW_LIMIT } from "./overview-loader.js";

export function OverviewPlane({ nodes, viewport, area, previews, mounted, liveScreen, revision, onError }) {
  const { t } = useI18n();
  const frame = useRef(null), latest = useRef(null), jobs = useRef(null), [loaded, setLoaded] = useState(0);
  const nonce = useMemo(() => crypto.randomUUID(), []);
  const source = useMemo(() => new URL(`./overview.html?runtime=${nonce}`, import.meta.url).href, [nonce]);
  const send = useCallback(message => frame.current?.contentWindow?.postMessage({ channel: "app-canvas-overview", token: nonce, ...message }, "*"), [nonce]);
  const sources = useMemo(() => nodes.filter(n => n.type === "screen" && n.data.sharedUrl && !n.data.nativePreview).map(n => ({ id: n.id, url: n.data.sharedUrl })), [nodes]);
  const sourceKey = JSON.stringify(sources.length <= OVERVIEW_LIMIT ? sources : sources.filter(source => previews.has(source.id) && !mounted.has(source.id)));
  const layout = nodes.filter(n => n.type === "screen" && n.data.sharedUrl && !n.data.nativePreview).map(n => ({ id: n.id, x: n.position.x, y: n.position.y, width: n.data.viewport.width, height: n.data.viewport.height, visible: previews.has(n.id) && !mounted.has(n.id) && n.id !== liveScreen }));
  latest.current = { viewport, layout };
  useEffect(() => { if (loaded) send({ command: "camera", viewport }); }, [loaded, viewport, send]);
  useEffect(() => { if (loaded) send({ command: "layout", items: layout }); }, [loaded, nodes, previews, mounted, liveScreen, send]);
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
        onError(old => ({ ...old, [source.id]: "Preview unavailable; select the screen to open the original app." }));
      },
    });
    jobs.current = loader;
    frame.current.removeAttribute("data-error"); onError({});
    send({ command: "clear" });
    send({ command: "camera", viewport: latest.current.viewport });
    send({ command: "layout", items: latest.current.layout });
    return () => loader.close();
  }, [loaded, revision, send, onError]);
  useEffect(() => {
    if (loaded) jobs.current?.sync(JSON.parse(sourceKey));
  }, [loaded, sourceKey, revision]);
  // Keep the iframe outside the transformed graph. An inverse scale produces
  // small final bounds but can still allocate large intermediate WebKit layers.
  return <div className="overview-plane" style={{ width: area.width, height: area.height }}>
    <iframe ref={frame} data-overview title={t("Full UI · shared isolated rendering")} src={source} sandbox="allow-scripts" inert tabIndex={-1} onLoad={() => setLoaded(old => old + 1)} />
  </div>;
}
