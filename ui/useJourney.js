import { useEffect, useRef, useState } from "react";
export function useJourney({ definition, bridge, navigate }) {
  const [state, update] = useState(null), [speed, setSpeed] = useState(900);
  const current = useRef(null), context = useRef({ bridge, navigate, speed });
  context.current = { bridge, navigate, speed };
  const stop = () => {
    const run = current.current; if (run) { run.cancelled = true; run.resume?.(); context.current.bridge.cancel("journey"); }
    current.current = null; update(null);
  };
  useEffect(() => { stop(); }, [definition?.id]);
  useEffect(() => () => { if (current.current) { current.current.cancelled = true; current.current.resume?.(); } }, []);
  const start = async (single = false) => {
    if (!definition) return;
    stop();
    const run = { key: crypto.randomUUID(), definition, screen: definition.entry, index: 0, paused: single, allowance: single ? 1 : Infinity, cancelled: false };
    current.current = run;
    update({ ...run, status: "loading" }); context.current.navigate(run.screen);
    try {
      await context.current.bridge.whenReady("journey", run.key);
      if (run.cancelled) return;
      for (let index = 0; index < definition.steps.length; index++) {
        while (run.paused && run.allowance <= 0 && !run.cancelled) {
          update({ ...run, status: "paused" }); await new Promise((resolve) => { run.resume = resolve; });
        }
        if (run.cancelled) return;
        run.index = index;
        update({ ...run, status: "playing" });
        for (const action of definition.steps[index].actions) {
          if (run.cancelled) return;
          await context.current.bridge.command("journey", action);
        }
        if (run.cancelled) return;
        run.screen = definition.steps[index].screen; run.completed = index + 1; run.allowance--;
        context.current.navigate(run.screen); update({ ...run, status: run.paused ? "paused" : "playing" });
        if (!run.paused && context.current.speed) await new Promise((resolve) => { const timer = setTimeout(resolve, context.current.speed); run.resume = () => { clearTimeout(timer); resolve(); }; });
      }
      if (!run.cancelled) update({ ...run, status: "complete" });
    } catch (error) { if (!run.cancelled) update({ ...run, status: "error", error: error.message }); }
  };
  const resume = (single = false) => {
    const run = current.current;
    if (!run || state?.status === "complete" || state?.status === "error") return start(single);
    run.paused = single; run.allowance = single ? 1 : Infinity;
    update({ ...run, status: "playing" }); run.resume?.();
  };
  return { state, speed, setSpeed, start, stop, resume, pause: () => { if (current.current) { current.current.paused = true; current.current.allowance = 0; update((old) => ({ ...old, status: "paused" })); } } };
}
