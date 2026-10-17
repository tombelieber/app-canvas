import { useEffect, useRef, useState } from "react";
import { locateStep, stepOffset } from "../lib/playback.mjs";

export function useJourney({ definitions, bridge, navigate }) {
  const [state, update] = useState(null), [speed, setSpeed] = useState(900);
  const current = useRef(null), context = useRef({ bridge, navigate, speed });
  context.current = { bridge, navigate, speed };
  const planKey = definitions.map(j => j.id).join(",");
  const stop = () => {
    const run = current.current;
    if (run) { run.cancelled = true; run.resume?.(); context.current.bridge.cancel("journey"); }
    current.current = null; update(null);
  };
  useEffect(() => { stop(); }, [planKey]);
  useEffect(() => () => { if (current.current) { current.current.cancelled = true; current.current.resume?.(); } }, []);
  useEffect(() => { current.current?.resume?.(); }, [speed]);

  const start = async (single = false, { presentation = false, fromQueue = 0, fromStep = 0, paused = single, history } = {}) => {
    if (!definitions.length) return;
    stop();
    const run = {
      paused, allowance: single ? 1 : paused ? 0 : Infinity, cancelled: false,
      finished: history?.finished || [], skipped: history?.skipped || [], trace: [],
      queueLength: definitions.length, presentation, playbackId: history?.playbackId || crypto.randomUUID(),
    };
    current.current = run;
    const publish = (status) => {
      run.status = status;
      if (!run.cancelled) update({ ...run, finished: [...run.finished], skipped: [...run.skipped], trace: [...run.trace] });
    };
    const permission = async () => {
      while (run.paused && run.allowance <= 0 && !run.cancelled) {
        publish("paused"); await new Promise(resolve => { run.resume = resolve; });
      }
      return !run.cancelled;
    };
    const hold = (duration) => new Promise(resolve => {
      if (!duration || run.paused || run.fastForward || run.cancelled) return resolve();
      const wake = () => { clearTimeout(timer); if (run.resume === wake) run.resume = null; resolve(); };
      const timer = setTimeout(wake, duration); run.resume = wake;
    });
    try {
      for (let q = fromQueue; q < definitions.length; q++) {
        if (q > fromQueue && !(await permission())) return;
        run.definition = definitions[q]; run.queueIndex = q; run.index = 0; run.completed = 0; run.actionIndex = 0;
        run.screen = run.definition.entry; run.key = crypto.randomUUID();
        publish("loading"); context.current.navigate(run.screen);
        await context.current.bridge.whenReady("journey", run.key);
        if (run.cancelled) return;
        if (presentation && !fromStep) { publish(run.paused ? "paused" : "playing"); await hold(context.current.speed); }
        for (let i = 0; i < run.definition.steps.length; i++) {
          const rebuilding = q === fromQueue && i < fromStep;
          if (!rebuilding && !(await permission())) return;
          run.index = i; run.actionIndex = 0; run.inStep = true; publish(rebuilding ? "seeking" : "playing");
          const step = run.definition.steps[i];
          for (const action of step.actions) {
            if (run.cancelled || (!rebuilding && presentation && !(await permission()))) return;
            run.inStep = true;
            const performed = !["expect", "fault"].includes(action.type);
            const cue = presentation && performed && !rebuilding && !run.fastForward;
            await context.current.bridge.command("journey", cue ? { ...action, presentation: { delay: Math.min(900, context.current.speed / 2) } } : action);
            if (run.cancelled) return;
            run.actionIndex++;
            if (presentation) {
              run.inStep = false; publish(rebuilding ? "seeking" : run.paused && run.allowance <= 0 ? "paused" : "playing");
              if (cue) await hold(context.current.speed / 2);
            }
          }
          if (run.cancelled) return;
          run.trace.push({ from: run.screen, to: step.screen });
          run.screen = step.screen; run.completed = i + 1; run.inStep = false;
          if (!rebuilding) { run.allowance--; run.fastForward = false; }
          context.current.navigate(run.screen);
          const end = i === run.definition.steps.length - 1;
          if (end) run.finished.push(run.definition.id);
          if (end && q === definitions.length - 1) { publish("complete"); return; }
          publish(rebuilding ? "seeking" : run.paused ? "paused" : "playing");
          if (!rebuilding) await hold(context.current.speed);
        }
        fromStep = 0;
      }
    } catch (error) { if (!run.cancelled) { run.error = error.message; publish("error"); } }
  };
  const resume = (single = false) => {
    const run = current.current;
    if (!run || ["complete", "error"].includes(run.status)) return start(single, { presentation: run?.presentation });
    run.paused = single; run.allowance = single ? 1 : Infinity;
    update(old => ({ ...old, status: "playing" })); run.resume?.();
  };
  const pause = () => {
    const run = current.current; if (!run) return;
    run.paused = true; run.allowance = 0;
    update(old => ({ ...old, status: run.inStep ? "pausing" : "paused" }));
    if (!run.inStep) run.resume?.();
  };
  const nextStep = () => {
    const run = current.current;
    if (!run || ["complete", "error", "loading", "seeking"].includes(run.status)) return;
    run.fastForward = true; resume(true);
  };
  const seek = (position) => {
    const run = current.current, target = locateStep(definitions, position);
    if (!run || !target) return;
    const previous = definitions.slice(0, target.queue).map(j => j.id);
    start(false, {
      presentation: run.presentation, fromQueue: target.queue, fromStep: target.step,
      paused: run.paused || ["complete", "error"].includes(run.status),
      history: {
        playbackId: run.playbackId,
        finished: previous.filter(id => run.finished.includes(id)),
        skipped: previous.filter(id => !run.finished.includes(id)),
      },
    });
  };
  const changeDemo = (direction) => {
    const index = (current.current?.queueIndex ?? 0) + direction;
    if (index >= 0 && index < definitions.length) seek(stepOffset(definitions, index));
  };
  return { state, speed, setSpeed, start, stop, resume, pause, nextStep, seek, changeDemo };
}
