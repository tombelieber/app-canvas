import { useEffect, useRef, useState } from "react";

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

  const start = async (single = false, { presentation = false } = {}) => {
    if (!definitions.length) return;
    stop();
    const run = { paused: single, allowance: single ? 1 : Infinity, cancelled: false, finished: [], trace: [], queueLength: definitions.length, presentation };
    current.current = run;
    const publish = (status) => update({ ...run, finished: [...run.finished], trace: [...run.trace], status });
    const permission = async () => {
      while (run.paused && run.allowance <= 0 && !run.cancelled) {
        publish("paused"); await new Promise(resolve => { run.resume = resolve; });
      }
      return !run.cancelled;
    };
    const hold = (duration) => new Promise(resolve => {
      if (!duration || run.paused || run.cancelled) return resolve();
      const wake = () => { clearTimeout(timer); if (run.resume === wake) run.resume = null; resolve(); };
      const timer = setTimeout(wake, duration); run.resume = wake;
    });
    try {
      for (let q = 0; q < definitions.length; q++) {
        if (q && !(await permission())) return;
        run.definition = definitions[q]; run.queueIndex = q; run.index = 0; run.completed = 0;
        run.screen = run.definition.entry; run.key = crypto.randomUUID();
        publish("loading"); context.current.navigate(run.screen);
        await context.current.bridge.whenReady("journey", run.key);
        if (run.cancelled) return;
        if (presentation) { publish(run.paused ? "paused" : "playing"); await hold(context.current.speed); }
        for (let i = 0; i < run.definition.steps.length; i++) {
          if (!(await permission())) return;
          run.index = i; run.inStep = true; publish("playing");
          const step = run.definition.steps[i];
          for (const action of step.actions) {
            if (run.cancelled || (presentation && !(await permission()))) return;
            run.inStep = true;
            const performed = !["expect", "fault"].includes(action.type);
            await context.current.bridge.command("journey", presentation && performed ? { ...action, presentation: { delay: Math.min(900, context.current.speed / 2) } } : action);
            if (run.cancelled) return;
            if (presentation && performed) {
              run.inStep = false; publish(run.paused ? "paused" : "playing");
              await hold(context.current.speed / 2);
            }
          }
          if (run.cancelled) return;
          run.trace.push({ from: run.screen, to: step.screen });
          run.screen = step.screen; run.completed = i + 1; run.allowance--; run.inStep = false;
          context.current.navigate(run.screen);
          const end = i === run.definition.steps.length - 1;
          if (end) run.finished.push(run.definition.id);
          if (end && q === definitions.length - 1) { publish("complete"); return; }
          publish(run.paused ? "paused" : "playing");
          await hold(context.current.speed);
        }
      }
    } catch (error) { if (!run.cancelled) { run.error = error.message; publish("error"); } }
  };
  const resume = (single = false) => {
    const run = current.current;
    if (!run || state?.status === "complete" || state?.status === "error") return start(single);
    run.paused = single; run.allowance = single ? 1 : Infinity;
    update(old => ({ ...old, status: "playing" })); run.resume?.();
  };
  const pause = () => {
    const run = current.current; if (!run) return;
    run.paused = true; run.allowance = 0;
    update(old => ({ ...old, status: run.inStep ? "pausing" : "paused" }));
    if (!run.inStep) run.resume?.();
  };
  return { state, speed, setSpeed, start, stop, resume, pause };
}
