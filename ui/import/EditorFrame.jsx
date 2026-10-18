import React, { useEffect, useMemo, useRef, useState } from "react";
import { renderDocument } from "../../lib/import/render.mjs";
export function EditorFrame({ document, assets, selected, onSelect, onOperation, onBrowse, prototype, links = [], onNavigate }) {
  const frame = useRef(null), token = useMemo(() => crypto.randomUUID(), [document.id, prototype]);
  const [acknowledged, acknowledge] = useState(0);
  const content = useMemo(() => renderDocument(document, { assets }), [document, assets]);
  const source = `/import/editor?runtime=${encodeURIComponent(token)}${prototype ? "&prototype=1" : ""}`;
  const latest = useRef(null), revision = useRef(0);
  const renderedRevision = useMemo(() => ++revision.current, [content, token, links]);
  latest.current = { channel: "app-canvas-import-editor", token, type: "render", html: content, selected, links, revision: renderedRevision };
  const render = () => { frame.current?.contentWindow?.postMessage(latest.current, "*"); };
  useEffect(() => {
    const listener = event => {
      if (event.source !== frame.current?.contentWindow || event.data?.channel !== "app-canvas-import-editor" || event.data.token !== token) return;
      const message = event.data;
      if (message.type === "select" && typeof message.layerId === "string") onSelect(message.layerId);
      if (message.type === "operation" && message.operation && ["move", "resize"].includes(message.operation.type)) onOperation(message.operation);
      if (message.type === "browse") onBrowse();
      if (message.type === "navigate" && links.some(link => link.to === message.to)) onNavigate(message.to);
      if (message.type === "ready") render();
      if (message.type === "rendered" && message.revision === latest.current.revision) acknowledge(message.revision);
    };
    window.addEventListener("message", listener); return () => window.removeEventListener("message", listener);
  }, [token, selected, onSelect, onOperation, onBrowse, links, onNavigate]);
  useEffect(render, [content, assets, token, links]);
  useEffect(() => { frame.current?.contentWindow?.postMessage({ channel: "app-canvas-import-editor", token, type: "select", layerId: selected }, "*"); }, [selected, token]);
  return <><iframe ref={frame} data-import-editor data-ready={acknowledged === renderedRevision} onLoad={render} title={prototype ? "Imported prototype" : "Imported UI editor"} sandbox="allow-scripts" src={source} style={{ width: document.viewport.width, height: document.viewport.height, transform: `scale(${390 / document.viewport.width})`, transformOrigin: "0 0", border: 0, pointerEvents: acknowledged === renderedRevision ? "auto" : "none" }} />{acknowledged !== renderedRevision && <span className="import-rendering">Updating preview…</span>}</>;
}
