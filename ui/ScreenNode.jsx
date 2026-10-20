import { useI18n } from "./i18n.jsx";
import React, { createContext, useContext } from "react";
import { Handle, Position } from "@xyflow/react";
import { LiveFrame } from "./LiveFrame.jsx";
import { outcomes } from "../lib/coverage.mjs";
export const PreviewContext = createContext(null);
export const ScreenNode = React.memo(function ScreenNode({ id, data }) {
  // Shells must not subscribe to camera-driven preview context. Retained
  // originals always keep their body component and iframe ancestor mounted.
  return data.shellOnly ? <><Handle type="target" position={Position.Left} /><Handle type="source" position={Position.Right} /></> : <ScreenBody id={id} data={data} />;
});
function ScreenBody({ id, data }) {
  const { t } = useI18n();
  const ctx = useContext(PreviewContext), active = ctx.active === id, selected = ctx.selected === id;
  const live = ctx.mounted.has(id);
  const deferred = !live && !data.nativePreview && (!ctx.previews.has(id) || !data.domUrl && !data.sharedUrl);
  return <article className={`screen-frame ${selected ? "is-selected" : ""} ${active ? "is-interactive" : ""} ${(data.sharedUrl || data.nativePreview) && !live ? "shared-preview" : ""}`} data-visible={data.visible} data-outcome={data.screen.outcome || "neutral"} style={{ width: data.width || 390 }}>
    <Handle type="target" position={Position.Left} />
    <header className="frame-label" title={data.screen.title}><span>{data.screen.title}</span><small>{data.screen.outcome && <b className="state-badge" data-outcome={data.screen.outcome}>{t(outcomes[data.screen.outcome])}</b>} {active ? t("LIVE · interacting") : live ? "LIVE" : data.nativePreview ? t("Native preview") : deferred ? t("Load on demand") : "HTML · CSS"}</small></header>
    <div className={`screen-surface ${active ? "nodrag nopan nowheel" : ""}`} style={{ height: data.height }}>
      {data.error ? <div className="render-error">{t("Could not render screen:")}{data.error}</div> : data.url && live ?
        <LiveFrame id={id} url={data.url} viewport={data.viewport} epoch={`${ctx.revision}-${ctx.resets[id] || 0}`} runId={ctx.runId} interactive={active} bridge={ctx.bridge} title={t("{0} · real UI", data.screen.title)} /> :
        ctx.previewErrors[id] ? <div className="render-error">{t(ctx.previewErrors[id])}</div> : !data.nativePreview && ctx.previews.has(id) && data.domUrl && !data.sharedUrl ? <iframe data-preview={id} title={t("{0} · full UI", data.screen.title)} src={`${data.domUrl}${data.domUrl.includes("?") ? "&" : "?"}__canvas_revision=${ctx.revision}`} sandbox="allow-scripts" inert tabIndex={-1} onLoad={event => { event.currentTarget.dataset.ready = "true"; }} style={{ width: data.viewport.width, height: data.viewport.height, transform: `scale(${390 / data.viewport.width})`, transformOrigin: "top left", pointerEvents: "none" }} /> : data.visible && deferred ? <div className="preview-deferred">{t("Zoom or select to see the full screen")}</div> : null}
    </div>
    <Handle type="source" position={Position.Right} />
  </article>;
}
export function GroupNode({ data }) {
  const { t } = useI18n();
  return <div className="board-group"><h2 style={{ color: data.color }}>{data.title} <span>{t("{0} screens", data.count)}</span></h2></div>;
}
