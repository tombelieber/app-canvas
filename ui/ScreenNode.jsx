import React, { createContext, useContext } from "react";
import { Handle, Position } from "@xyflow/react";
import { LiveFrame } from "./LiveFrame.jsx";
import { outcomes } from "../lib/coverage.mjs";
export const PreviewContext = createContext(null);
export const ScreenNode = React.memo(function ScreenNode({ id, data }) {
  const ctx = useContext(PreviewContext), active = ctx.active === id, selected = ctx.selected === id;
  const live = ctx.mounted.has(id);
  const deferred = !live && (!ctx.previews.has(id) || !data.domUrl && !data.sharedUrl);
  return <article className={`screen-frame ${selected ? "is-selected" : ""} ${active ? "is-interactive" : ""} ${data.sharedUrl && !live ? "shared-preview" : ""}`} data-visible={data.visible} data-outcome={data.screen.outcome || "neutral"} style={{ width: data.width || 390 }}>
    <Handle type="target" position={Position.Left} />
    <header className="frame-label" title={data.screen.title}><span>{data.screen.title}</span><small>{data.screen.outcome && <b className="state-badge" data-outcome={data.screen.outcome}>{outcomes[data.screen.outcome]}</b>} {active ? "LIVE · 操作中" : live ? "LIVE" : deferred ? "按需載入" : "HTML · CSS"}</small></header>
    <div className={`screen-surface ${active ? "nodrag nopan nowheel" : ""}`} style={{ height: data.height }}>
      {data.error ? <div className="render-error">畫面未能生成：{data.error}</div> : data.url && live ?
        <LiveFrame id={id} url={data.url} viewport={data.viewport} epoch={`${ctx.revision}-${ctx.resets[id] || 0}`} runId={ctx.runId} interactive={active} bridge={ctx.bridge} title={`${data.screen.title} · 真實 UI`} /> :
        ctx.previewErrors[id] ? <div className="render-error">{ctx.previewErrors[id]}</div> : ctx.previews.has(id) && data.domUrl && !data.sharedUrl ? <iframe data-preview={id} title={`${data.screen.title} · 完整 UI`} src={`${data.domUrl}${data.domUrl.includes("?") ? "&" : "?"}__canvas_revision=${ctx.revision}`} sandbox="allow-scripts" inert tabIndex={-1} onLoad={event => { event.currentTarget.dataset.ready = "true"; }} style={{ width: data.viewport.width, height: data.viewport.height, transform: `scale(${390 / data.viewport.width})`, transformOrigin: "top left", pointerEvents: "none" }} /> : data.visible && deferred ? <div className="preview-deferred">放大或選取以檢視完整畫面</div> : null}
    </div>
    <Handle type="source" position={Position.Right} />
  </article>;
});
export function GroupNode({ data }) {
  return <div className="board-group"><h2 style={{ color: data.color }}>{data.title} <span>{data.count} 個畫面</span></h2></div>;
}
