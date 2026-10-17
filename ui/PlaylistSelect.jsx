import React from "react";
import { journeyPlan } from "../lib/playback.mjs";

export function PlaylistOptions({ definitions, pages, catalog, scope = "all", selected, browse = false }) {
  const scoped = definitions.filter(j => scope === "all" || journeyPlan({ journeys: [j], catalog }, `__page__:${scope}`).length || j.id === selected);
  const flows = scoped.filter(j => j.kind !== "case"), cases = scoped.filter(j => j.kind === "case");
  return <>
    {browse && <option value="">全部畫面</option>}
    <optgroup label="連續播放 · 全 App">
      <option value="__all__">全部 Demo（{definitions.length}）</option>
      <option value="__flows__">全部互動流程（{definitions.filter(j => j.kind !== "case").length}）</option>
      <option value="__cases__">全部獨立情境（{definitions.filter(j => j.kind === "case").length}）</option>
    </optgroup>
    <optgroup label="按頁面 · 包括完整跨頁流程">{pages.map(page => {
      const count = journeyPlan({ journeys: definitions, catalog }, `__page__:${page.id}`).length;
      return <option key={page.id} value={`__page__:${page.id}`} disabled={!count}>{page.title}（{count}）</option>;
    })}</optgroup>
    {!!flows.length && <optgroup label="互動流程">{flows.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</optgroup>}
    {!!cases.length && <optgroup label="獨立情境 · 由指定條件開始">{cases.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</optgroup>}
  </>;
}

export function SpeedOptions() {
  return <><option value="1800">0.5×</option><option value="900">1×</option><option value="600">1.5×</option><option value="450">2×</option><option value="225">4×</option><option value="0">即時</option></>;
}
