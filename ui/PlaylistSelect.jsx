import { useI18n } from "./i18n.jsx";
import React from "react";
import { journeyPlan } from "../lib/playback.mjs";

export function PlaylistOptions({ definitions, pages, catalog, scope = "all", selected, browse = false }) {
  const { t } = useI18n();
  const scopedIds = scope === "all" ? null : new Set(journeyPlan({ journeys: definitions, catalog }, `__page__:${scope}`).map(j => j.id));
  const scoped = scopedIds ? definitions.filter(j => scopedIds.has(j.id) || j.id === selected) : definitions;
  const flows = scoped.filter(j => j.kind !== "case"), cases = scoped.filter(j => j.kind === "case");
  return <>
    {browse && <option value="">{t("All screens")}</option>}
    <optgroup label={t("Continuous playback · whole app")}>
      <option value="__all__">{t("All demos ({0})", definitions.length)}</option>
      <option value="__flows__">{t("All flows ({0})", definitions.filter(j => j.kind !== "case").length)}</option>
      <option value="__cases__">{t("All cases ({0})", definitions.filter(j => j.kind === "case").length)}</option>
    </optgroup>
    <optgroup label={t("By page · includes whole cross-page flows")}>{pages.map(page => {
      const count = journeyPlan({ journeys: definitions, catalog }, `__page__:${page.id}`).length;
      return <option key={page.id} value={`__page__:${page.id}`} disabled={!count}>{page.title}（{count}）</option>;
    })}</optgroup>
    {!!flows.length && <optgroup label={t("Interactive flows")}>{flows.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</optgroup>}
    {!!cases.length && <optgroup label={t("Standalone cases · start from fixtures")}>{cases.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</optgroup>}
  </>;
}

export function SpeedOptions() {
  const { t } = useI18n();
  return <><option value="1800">0.5×</option><option value="900">1×</option><option value="600">1.5×</option><option value="450">2×</option><option value="225">4×</option><option value="0">{t("Instant")}</option></>;
}
