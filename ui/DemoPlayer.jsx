import React, { useEffect, useRef, useState } from "react";
import { formatTime, remainingDuration, stepCount, stepOffset } from "../lib/playback.mjs";
import { PlaylistOptions, SpeedOptions } from "./PlaylistSelect.jsx";

// Keep clock ticks inside the footer, away from the canvas's screen layout.
function usePlaybackClock(id, status) {
  const clock = useRef({ id, elapsed: 0 }), [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (clock.current.id !== id) clock.current = { id, elapsed: 0 };
    setElapsed(clock.current.elapsed);
    if (!["loading", "playing", "pausing", "seeking"].includes(status)) return;
    const started = performance.now(), base = clock.current.elapsed;
    const tick = () => setElapsed(base + performance.now() - started);
    const timer = setInterval(tick, 250);
    return () => { clearInterval(timer); clock.current.elapsed = base + performance.now() - started; };
  }, [id, status]);
  return elapsed;
}

function StepTimeline({ position, total, disabled, onSeek }) {
  const dragging = useRef(false), [preview, setPreview] = useState(null);
  const value = preview ?? position;
  const commit = event => {
    if (!dragging.current) return;
    dragging.current = false; setPreview(null); onSeek(Number(event.currentTarget.value));
  };
  return <input type="range" aria-label="Demo 時間軸" aria-valuetext={`步驟 ${value}/${total}；定位會由此流程重新播放必要操作`} min="0" max={total} step="1" value={value} disabled={disabled} style={{ "--progress": `${total ? value / total * 100 : 0}%` }}
    onPointerDown={() => { dragging.current = true; }} onPointerUp={commit} onBlur={commit}
    onPointerCancel={() => { dragging.current = false; setPreview(null); }}
    onChange={event => { const next = Number(event.target.value); if (dragging.current) setPreview(next); else onSeek(next); }} />;
}

export function DemoPlayer({ player, definitions, title, catalog, pages, journeys, selected, onSelect, onReplay, onExit }) {
  const state = player.state, status = state?.status || "loading";
  const done = status === "complete", failed = status === "error", paused = status === "paused";
  const preparing = !state || ["loading", "seeking"].includes(status);
  const total = stepCount(definitions), position = state ? stepOffset(definitions, state.queueIndex) + state.completed : 0;
  const progress = total ? Math.round(position / total * 100) : 0;
  const elapsed = usePlaybackClock(state?.playbackId, status), remaining = remainingDuration(definitions, state, player.speed);
  const next = state && (state.definition.steps[state.completed]?.title || definitions[state.queueIndex + 1]?.steps[0]?.title);
  const skipped = state?.skipped.length || 0;
  return <section className="demo-player" role="region" aria-label="Demo 播放" data-status={status} data-finished={state?.finished.length || 0} data-step={state?.completed || 0} data-queue={state?.queueIndex || 0} data-skipped={skipped}>
    <div className="demo-heading"><span>{title}</span><strong>{state?.definition.title || "準備 Demo…"}</strong>
      {state && <small>{state.definition.kind === "case" ? "獨立情境" : "互動流程"} {state.queueIndex + 1}/{state.queueLength} · 步驟 {position}/{total}</small>}
    </div>
    <label className="demo-scope"><span>播放範圍</span><select aria-label="Demo 播放範圍" value={selected} onChange={event => onSelect(event.target.value)}>
      <PlaylistOptions definitions={journeys} pages={pages} catalog={catalog} selected={selected} />
    </select></label>
    <div className="demo-description">
      <p className="demo-caption" role="status">{done ? skipped ? `播放結束 · 已完成 ${state.finished.length} · 略過 ${skipped}` : "✓ 示範完成" : failed ? "步驟失敗 · 已停止" : status === "loading" ? "正在準備畫面…" : status === "seeking" ? "正在跳到指定步驟…" : `${paused ? "已暫停 · " : status === "pausing" ? "完成目前操作後暫停 · " : ""}${state?.definition.steps[state.index]?.title || "準備播放…"}`}</p>
      <p className="demo-next" aria-label="下一個動作">{done ? "播放結束" : `接住：${next || "完成目前 Demo"}`}</p>
    </div>
    {state?.error && <p className="demo-error" role="alert">{state.error}</p>}
    <div className="demo-timeline">
      <time aria-label="Demo 已播放時間" dateTime={`PT${Math.floor(elapsed / 1000)}S`}>{formatTime(elapsed)}</time>
      <StepTimeline key={selected} position={position} total={total} disabled={!state || status === "loading"} onSeek={player.seek} />
      <time aria-label="Demo 預計剩餘時間" dateTime={`PT${Math.ceil(remaining / 1000)}S`} title="預計剩餘播放時間；載入及等待 app 結果可能需要更多時間">約 {formatTime(Math.ceil(remaining / 1000) * 1000)}</time>
    </div>
    <div className="demo-controls">
      <button aria-label="上一個 Demo" title="上一個 Demo" disabled={!state?.queueIndex || preparing} onClick={() => player.changeDemo(-1)}>⏮</button>
      {!done && !failed && <button className="present" aria-label={paused ? "繼續 Demo" : "暫停 Demo"} disabled={!state || status === "pausing" || status === "seeking"} onClick={paused ? () => player.resume() : player.pause}>{paused ? "▶ 繼續" : "⏸ 暫停"}</button>}
      {(done || failed) && <button className="present" aria-label="重播 Demo" onClick={onReplay}>↺ 重播</button>}
      <button aria-label="下一步" title="快轉完成目前步驟，然後暫停" disabled={done || failed || preparing} onClick={player.nextStep}>下一步 ⏵</button>
      <button aria-label="下一個 Demo" title="略過目前 Demo，播放下一個" disabled={!state || state.queueIndex >= definitions.length - 1 || preparing} onClick={() => player.changeDemo(1)}>下一個 Demo ⏭</button>
      {!done && !failed && <button aria-label="重播 Demo" title="重新播放所選範圍" onClick={onReplay}>↺</button>}
      <label className="demo-speed"><span>速度</span><select aria-label="Demo 播放速度" value={player.speed} onChange={event => player.setSpeed(Number(event.target.value))}><SpeedOptions /></select></label>
      <button className="demo-exit" aria-label="退出 Demo" onClick={onExit}>退出 <kbd>Esc</kbd></button>
    </div>
    <div className="demo-progress" role="progressbar" aria-label="Demo 進度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
  </section>;
}
