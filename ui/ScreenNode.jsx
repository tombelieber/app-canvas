import React, { createContext, useContext } from "react";
import { Handle, Position } from "@xyflow/react";
import { LiveFrame } from "./LiveFrame.jsx";
export const PreviewContext = createContext(null);
export const ScreenNode = React.memo(function ScreenNode({ id, data }) {
  const ctx = useContext(PreviewContext), active = ctx.active === id, selected = ctx.selected === id;
  return <article className={`screen-frame ${selected ? "is-selected" : ""} ${active ? "is-interactive" : ""}`} style={{ width: 390 }}>
    <Handle type="target" position={Position.Left} />
    <header className="frame-label"><span>{data.screen.title}</span><small>{active ? "LIVE · 操作中" : "LIVE"}</small></header>
    <div className={`screen-surface ${active ? "nodrag nopan nowheel" : ""}`} style={{ height: data.height }}>
      {data.error ? <div className="render-error">畫面未能生成：{data.error}</div> : data.url ?
        <LiveFrame id={id} url={data.url} viewport={data.viewport} epoch={`${ctx.revision}-${ctx.resets[id] || 0}`} runId={ctx.runId} interactive={active} bridge={ctx.bridge} title={`${data.screen.title} · 真實 UI`} /> :
        <div className="render-pending">正在載入 App code…</div>}
    </div>
    <Handle type="source" position={Position.Right} />
  </article>;
});
export function GroupNode({ data }) {
  return <div className="board-group"><h2 style={{ color: data.color }}>{data.title} <span>{data.count} 個畫面</span></h2></div>;
}
