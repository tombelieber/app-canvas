import React from "react";
export function JourneyPanel({ definitions, selected, onSelect, player }) {
  if (!definitions.length) return null;
  const state = player.state, busy = state && !["error", "complete", "paused"].includes(state.status);
  return <div className="journey-panel" data-status={state?.status || "idle"} data-step={state?.completed || 0}>
    <label>流程<select aria-label="播放流程" value={selected || ""} onChange={(e) => onSelect(e.target.value)}><option value="">全部畫面</option>{definitions.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select></label>
    <div className="journey-controls"><button disabled={!selected || busy} onClick={() => player.resume()}>▶ 播放</button><button disabled={!busy} onClick={player.pause}>⏸ 暫停</button><button disabled={!selected || busy} onClick={() => player.resume(true)}>單步</button><button disabled={!selected} onClick={() => player.start()}>重播</button><button disabled={!state} onClick={player.stop}>停止</button>
      <select aria-label="播放速度" value={player.speed} onChange={(e) => player.setSpeed(Number(e.target.value))}><option value="900">正常</option><option value="1800">慢速</option><option value="0">即時</option></select>
    </div>
    {state ? <p role="status">{state.status === "complete" ? "✓ 已完成" : state.status === "error" ? "✕ 步驟失敗" : state.status === "paused" ? "已暫停" : "正在播放"} · {state.completed || 0}/{state.definition.steps.length} · {state.definition.steps[state.index]?.title}{state.error && <strong>{state.error}</strong>}</p> : <p>選擇流程可查看狀態圖；播放會操作真實 UI，同步聚焦每個已驗證步驟。</p>}
  </div>;
}
