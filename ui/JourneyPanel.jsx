import { useI18n } from "./i18n.jsx";
import React from "react";
import { PlaylistOptions, SpeedOptions } from "./PlaylistSelect.jsx";
export function JourneyPanel({ definitions, selected, onSelect, player, branches, onBranches, coverage, scope, catalog, pages }) {
  const { t } = useI18n();
  const state = player.state, busy = state && !["error", "complete", "paused"].includes(state.status);
  return <div className="journey-panel" data-status={state?.status || "idle"} data-step={state?.completed || 0} data-finished={state?.finished.length || 0}>
    {!!definitions.length && <>
      <label>{t("Playback scope")}<select aria-label={t("Play flow")} value={selected || ""} onChange={e => onSelect(e.target.value)}>
        <PlaylistOptions definitions={definitions} pages={pages} catalog={catalog} scope={scope} selected={selected} browse />
      </select></label>
      <div className={`journey-controls ${selected ? "is-selected" : ""}`}><button disabled={!selected || busy} onClick={() => player.resume()}>{t("▶ Play")}</button><button disabled={!busy} onClick={player.pause}>{t("⏸ Pause")}</button><button disabled={!selected || busy} onClick={() => player.resume(true)}>{t("Step")}</button><button disabled={!selected} onClick={() => player.start()}>{t("Replay")}</button><button disabled={!state} onClick={player.stop}>{t("Stop")}</button>
        <select aria-label={t("Playback speed")} value={player.speed} onChange={e => player.setSpeed(Number(e.target.value))}><SpeedOptions /></select>
        {selected && <label className="branch-choice"><input type="checkbox" checked={branches} onChange={e=>onBranches(e.target.checked)} />{t("Show other branches")}</label>}
      </div>
    </>}
    {state ? <p role="status">{state.status === "complete" ? t("✓ Complete") : state.status === "error" ? t("✕ Step failed") : state.status === "paused" ? t("Paused") : state.status === "pausing" ? t("Pause after this step") : t("Playing")}
      {state.queueLength > 1 && <> {t("· Flow/case")}{state.queueIndex + 1}/{state.queueLength} · {state.definition.title}</>}
      <span> · {state.completed || 0}/{state.definition.steps.length} · {state.definition.steps[state.index]?.title}</span>{state.error && <strong>{state.error}</strong>}
    </p> : null}
    {state?.definition.condition && <p className="entry-condition">{t("Starting condition:")}{state.definition.condition}</p>}
    {coverage.missing.length > 0 && <details className="coverage-missing"><summary>{t("Missing standalone checks:")}{coverage.missing.length} {t("cases")}</summary><p>{coverage.missing.join("、")}</p></details>}
    <details className="coverage-details"><summary>{t("Cases {0}/{1} · Flows {2}", coverage.checked, coverage.total, coverage.flows)}</summary><div className="state-legend"><span data-outcome="success">{t("Success")}</span><span data-outcome="failure">{t("Failure")}</span><span data-outcome="pending">{t("Waiting")}</span><span data-outcome="warning">{t("Warning")}</span><span>{t("Solid: action/recovery")}</span><span>{t("Dashed: condition/reference")}</span></div></details>
  </div>;
}
