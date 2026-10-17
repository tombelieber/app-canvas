import React from "react";
import { PlaylistOptions, SpeedOptions } from "./PlaylistSelect.jsx";
export function JourneyPanel({ definitions, selected, onSelect, player, branches, onBranches, coverage, scope, catalog, pages }) {
  const state = player.state, busy = state && !["error", "complete", "paused"].includes(state.status);
  return <div className="journey-panel" data-status={state?.status || "idle"} data-step={state?.completed || 0} data-finished={state?.finished.length || 0}>
    {!!definitions.length && <>
      <label>播放範圍<select aria-label="播放流程" value={selected || ""} onChange={e => onSelect(e.target.value)}>
        <PlaylistOptions definitions={definitions} pages={pages} catalog={catalog} scope={scope} selected={selected} browse />
      </select></label>
      <div className={`journey-controls ${selected ? "is-selected" : ""}`}><button disabled={!selected || busy} onClick={() => player.resume()}>▶ 播放</button><button disabled={!busy} onClick={player.pause}>⏸ 暫停</button><button disabled={!selected || busy} onClick={() => player.resume(true)}>單步</button><button disabled={!selected} onClick={() => player.start()}>重播</button><button disabled={!state} onClick={player.stop}>停止</button>
        <select aria-label="播放速度" value={player.speed} onChange={e => player.setSpeed(Number(e.target.value))}><SpeedOptions /></select>
        {selected && <label className="branch-choice"><input type="checkbox" checked={branches} onChange={e=>onBranches(e.target.checked)} />顯示其他分支</label>}
      </div>
    </>}
    {state ? <p role="status">{state.status === "complete" ? "✓ 已完成" : state.status === "error" ? "✕ 步驟失敗" : state.status === "paused" ? "已暫停" : state.status === "pausing" ? "此步完成後暫停" : "正在播放"}
      {state.queueLength > 1 && <> · 流程／情境 {state.queueIndex + 1}/{state.queueLength} · {state.definition.title}</>}
      <span> · {state.completed || 0}/{state.definition.steps.length} · {state.definition.steps[state.index]?.title}</span>{state.error && <strong>{state.error}</strong>}
    </p> : null}
    {state?.definition.condition && <p className="entry-condition">起始條件：{state.definition.condition}</p>}
    {coverage.missing.length > 0 && <details className="coverage-missing"><summary>未有獨立播放：{coverage.missing.length} 個情境</summary><p>{coverage.missing.join("、")}</p></details>}
    <details className="coverage-details"><summary>情境 {coverage.checked}/{coverage.total} · 流程 {coverage.flows}</summary><div className="state-legend"><span data-outcome="success">成功</span><span data-outcome="failure">失敗</span><span data-outcome="pending">等待</span><span data-outcome="warning">注意</span><span>實線：操作／恢復</span><span>虛線：條件／參照</span></div></details>
  </div>;
}
