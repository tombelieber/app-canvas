import React, { createContext, useContext } from "react";
import { Handle, Position } from "@xyflow/react";
import { LiveFrame } from "./LiveFrame.jsx";
import { outcomes } from "../lib/coverage.mjs";
export const PreviewContext = createContext(null);
export const ScreenNode = React.memo(function ScreenNode({ id, data }) {
  const ctx = useContext(PreviewContext), active = ctx.active === id, selected = ctx.selected === id;
  return <article className={`screen-frame ${data.compact ? "compact-state" : ""} ${selected ? "is-selected" : ""} ${active ? "is-interactive" : ""}`} data-visible={data.visible} data-outcome={data.screen.outcome || "neutral"} style={{ width: data.width || 390 }}>
    <Handle type="target" position={Position.Left} />
    <header className="frame-label" title={data.screen.title}><span>{data.screen.title}</span><small>{data.screen.outcome && <b className="state-badge" data-outcome={data.screen.outcome}>{outcomes[data.screen.outcome]}</b>} {active ? "LIVE · 操作中" : ctx.mounted.has(id) ? "LIVE" : "按需載入"}</small></header>
    {data.compact && <div className="machine-caption"><div><b>{data.pageSummary?.title || (data.featureSummary ? data.screen.feature : data.screen.title)}</b>{!data.pageSummary && <span className="state-badge" data-outcome={data.screen.outcome || "neutral"}>{outcomes[data.screen.outcome || "neutral"]}</span>}</div>{data.pageSummary ? <div className="feature-chips">{data.features?.map(f => <span key={f}>{f}</span>)}</div> : <p>{data.screen.condition || data.screen.title}</p>}<small>{data.caseCount > 1 ? `${data.caseCount} 個狀態 · ` : ""}{data.pageSummary ? "點選探索功能與畫面" : "點選展開真實 UI"}</small></div>}
    <div className={`screen-surface ${active ? "nodrag nopan nowheel" : ""}`} style={{ height: data.height }}>
      {data.error ? <div className="render-error">畫面未能生成：{data.error}</div> : data.url && ctx.mounted.has(id) ?
        <LiveFrame id={id} url={data.url} viewport={data.viewport} epoch={`${ctx.revision}-${ctx.resets[id] || 0}`} runId={ctx.runId} interactive={active} bridge={ctx.bridge} title={`${data.screen.title} · 真實 UI`} /> :
        <div className="preview-placeholder"><strong>{data.screen.title}</strong><p>{data.screen.condition || data.screen.feature}</p><span>選取或放大以載入真實 UI</span></div>}
    </div>
    <Handle type="source" position={Position.Right} />
  </article>;
});
export function GroupNode({ data }) {
  return <div className="board-group"><h2 style={{ color: data.color }}>{data.title} <span>{data.count} 個畫面</span></h2></div>;
}
