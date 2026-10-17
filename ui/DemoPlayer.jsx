import React from "react";

export function DemoPlayer({ player, definitions, title, onReplay, onExit }) {
  const state = player.state, status = state?.status || "loading";
  const done = status === "complete", failed = status === "error", paused = status === "paused";
  const total = definitions.reduce((sum, journey) => sum + journey.steps.length, 0);
  const completed = state ? definitions.slice(0, state.queueIndex).reduce((sum, journey) => sum + journey.steps.length, 0) + state.completed : 0;
  const progress = total ? Math.round(completed / total * 100) : 0;
  return <section className="demo-player" role="region" aria-label="Demo 播放" data-status={status} data-finished={state?.finished.length || 0} data-step={state?.completed || 0}>
    <div className="demo-heading"><span>{title}</span><strong>{state?.definition.title || "準備 Demo…"}</strong>
      {state && <small>{state.definition.kind === "case" ? "獨立情境" : "互動流程"} {state.queueIndex + 1}/{state.queueLength} · 步驟 {completed}/{total}</small>}
    </div>
    <p className="demo-caption" role="status">{done ? "✓ 示範完成" : failed ? "步驟失敗 · 已停止" : status === "loading" ? "正在準備畫面…" : `${paused ? "已暫停 · " : status === "pausing" ? "完成目前操作後暫停 · " : ""}${state?.definition.steps[state.index]?.title || "準備播放…"}`}</p>
    {state?.error && <p className="demo-error" role="alert">{state.error}</p>}
    <div className="demo-controls">
      {!done && !failed && <button className="present" aria-label={paused ? "繼續 Demo" : "暫停 Demo"} disabled={!state || status === "pausing"} onClick={paused ? () => player.resume() : player.pause}>{paused ? "▶ 繼續" : "⏸ 暫停"}</button>}
      <button aria-label="重播 Demo" onClick={onReplay}>↺ 重播</button>
      <label>速度<select aria-label="Demo 播放速度" value={player.speed} onChange={event => player.setSpeed(Number(event.target.value))}><option value="1800">慢速</option><option value="900">正常</option><option value="0">即時</option></select></label>
      <button className="demo-exit" aria-label="退出 Demo" onClick={onExit}>退出 <kbd>Esc</kbd></button>
    </div>
    <div className="demo-progress" role="progressbar" aria-label="Demo 進度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
  </section>;
}
