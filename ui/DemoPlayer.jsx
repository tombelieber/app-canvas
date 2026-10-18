import { useI18n, LanguagePicker } from "./i18n.jsx";
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
  const { t } = useI18n();
  const dragging = useRef(false), [preview, setPreview] = useState(null);
  const value = preview ?? position;
  const commit = event => {
    if (!dragging.current) return;
    dragging.current = false; setPreview(null); onSeek(Number(event.currentTarget.value));
  };
  return <input type="range" aria-label={t("Demo timeline")} aria-valuetext={t("Step {0}/{1}; seeking rebuilds this flow's prerequisites", value, total)} min="0" max={total} step="1" value={value} disabled={disabled} style={{ "--progress": `${total ? value / total * 100 : 0}%` }}
    onPointerDown={() => { dragging.current = true; }} onPointerUp={commit} onBlur={commit}
    onPointerCancel={() => { dragging.current = false; setPreview(null); }}
    onChange={event => { const next = Number(event.target.value); if (dragging.current) setPreview(next); else onSeek(next); }} />;
}

export function DemoPlayer({ player, definitions, title, catalog, pages, journeys, selected, onSelect, onReplay, onExit }) {
  const { t } = useI18n();
  const state = player.state, status = state?.status || "loading";
  const done = status === "complete", failed = status === "error", paused = status === "paused";
  const preparing = !state || ["loading", "seeking"].includes(status);
  const total = stepCount(definitions), position = state ? stepOffset(definitions, state.queueIndex) + state.completed : 0;
  const progress = total ? Math.round(position / total * 100) : 0;
  const elapsed = usePlaybackClock(state?.playbackId, status), remaining = remainingDuration(definitions, state, player.speed);
  const next = state && (state.definition.steps[state.completed]?.title || definitions[state.queueIndex + 1]?.steps[0]?.title);
  const skipped = state?.skipped.length || 0;
  return <section className="demo-player" role="region" aria-label={t("Demo playback")} data-status={status} data-finished={state?.finished.length || 0} data-step={state?.completed || 0} data-queue={state?.queueIndex || 0} data-skipped={skipped}>
    <div className="demo-heading"><span>{title}</span><strong>{state?.definition.title || t("Preparing Demo…")}</strong>
      {state && <small>{state.definition.kind === "case" ? t("Standalone case") : t("Interactive flows")} {state.queueIndex + 1}/{state.queueLength} {t("· Step")}{position}/{total}</small>}
    </div>
    <label className="demo-scope"><span>{t("Playback scope")}</span><select aria-label={t("Demo scope")} value={selected} onChange={event => onSelect(event.target.value)}>
      <PlaylistOptions definitions={journeys} pages={pages} catalog={catalog} selected={selected} />
    </select></label>
    <div className="demo-description">
      <p className="demo-caption" role="status">{done ? skipped ? t("Playback ended · completed {0} · skipped {1}", state.finished.length, skipped) : t("✓ Demo complete") : failed ? t("Step failed · stopped") : status === "loading" ? t("Preparing screen…") : status === "seeking" ? t("Seeking to step…") : `${paused ? t("Paused ·") : status === "pausing" ? t("Pause after current action ·") : ""}${state?.definition.steps[state.index]?.title || t("Preparing playback…")}`}</p>
      <p className="demo-next" aria-label={t("Next action")}>{done ? t("Playback ended") : t("Next: {0}", next || t("Finish current demo"))}</p>
    </div>
    {state?.error && <p className="demo-error" role="alert">{state.error}</p>}
    <div className="demo-timeline">
      <time aria-label={t("Demo elapsed time")} dateTime={`PT${Math.floor(elapsed / 1000)}S`}>{formatTime(elapsed)}</time>
      <StepTimeline key={selected} position={position} total={total} disabled={!state || status === "loading"} onSeek={player.seek} />
      <time aria-label={t("Demo remaining time")} dateTime={`PT${Math.ceil(remaining / 1000)}S`} title={t("Estimated remaining time; loading and app results may take longer")}>{t("About {0}", formatTime(Math.ceil(remaining / 1000) * 1000))}</time>
    </div>
    <div className="demo-controls"><LanguagePicker />
      <button aria-label={t("Previous demo")} title={t("Previous demo")} disabled={!state?.queueIndex || preparing} onClick={() => player.changeDemo(-1)}>⏮</button>
      {!done && !failed && <button className="present" aria-label={paused ? t("Resume demo") : t("Pause demo")} disabled={!state || status === "pausing" || status === "seeking"} onClick={paused ? () => player.resume() : player.pause}>{paused ? t("▶ Resume") : t("⏸ Pause")}</button>}
      {(done || failed) && <button className="present" aria-label={t("Replay demo")} onClick={onReplay}>{t("↺ Replay")}</button>}
      <button aria-label={t("Next")} title={t("Complete the current step, then pause")} disabled={done || failed || preparing} onClick={player.nextStep}>{t("Next step ⏵")}</button>
      <button aria-label={t("Next demo")} title={t("Skip this demo and play the next")} disabled={!state || state.queueIndex >= definitions.length - 1 || preparing} onClick={() => player.changeDemo(1)}>{t("Next demo ⏭")}</button>
      {!done && !failed && <button aria-label={t("Replay demo")} title={t("Replay the selected scope")} onClick={onReplay}>↺</button>}
      <label className="demo-speed"><span>{t("Speed")}</span><select aria-label={t("Demo speed")} value={player.speed} onChange={event => player.setSpeed(Number(event.target.value))}><SpeedOptions /></select></label>
      <button className="demo-exit" aria-label={t("Exit demo")} onClick={onExit}>{t("Exit")}<kbd>Esc</kbd></button>
    </div>
    <div className="demo-progress" role="progressbar" aria-label={t("Demo progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
  </section>;
}
