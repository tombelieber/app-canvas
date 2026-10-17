// A page selects complete authored journeys, including their prerequisites on
// other pages. It must never turn a graph edge into an invented interaction.
export function journeyPlan({ journeys, catalog }, selection) {
  if (selection === "__all__") return journeys;
  if (selection === "__flows__") return journeys.filter(j => j.kind !== "case");
  if (selection === "__cases__") return journeys.filter(j => j.kind === "case");
  if (selection?.startsWith("__page__:")) {
    const screens = new Set(catalog.filter(s => s.pageId === selection.slice(9)).map(s => s.id));
    return journeys.filter(j => [j.entry, ...j.steps.map(s => s.screen)].some(id => screens.has(id)));
  }
  return journeys.filter(j => j.id === selection);
}

export const stepCount = definitions => definitions.reduce((sum, j) => sum + j.steps.length, 0);
export const stepOffset = (definitions, queueIndex) => stepCount(definitions.slice(0, queueIndex));

export function locateStep(definitions, position) {
  let step = Math.max(0, Math.min(stepCount(definitions), Math.round(position) || 0));
  for (let queue = 0; queue < definitions.length; queue++) {
    if (step < definitions[queue].steps.length || queue === definitions.length - 1) return { queue, step };
    step -= definitions[queue].steps.length;
  }
  return null;
}

// This estimates authored presentation pacing. App loading and asynchronous
// assertions still take their actual time; the UI labels this as approximate.
export function remainingDuration(definitions, state, speed) {
  if (!state || state.status === "complete") return 0;
  let duration = 0;
  for (let q = state.queueIndex; q < definitions.length; q++) {
    const steps = definitions[q].steps;
    if (q > state.queueIndex || state.status === "loading") duration += speed;
    for (let s = q === state.queueIndex ? state.completed : 0; s < steps.length; s++) {
      const actions = steps[s].actions.slice(q === state.queueIndex && s === state.index ? state.actionIndex || 0 : 0);
      duration += actions.filter(a => !["expect", "fault"].includes(a.type)).length * (Math.min(900, speed / 2) + speed / 2);
      if (q < definitions.length - 1 || s < steps.length - 1) duration += speed;
    }
  }
  return duration;
}

export function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
