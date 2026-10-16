const kinds = new Set(["click", "fill", "check", "select", "file", "expect", "fault"]);
export function validateJourneys(journeys = [], screens) {
  if (!Array.isArray(journeys)) throw Error("journeys must be an array");
  const ids = new Set();
  for (const journey of journeys) {
    if (!/^[a-zA-Z0-9_-]+$/.test(journey.id || "") || ids.has(journey.id) || !journey.title) throw Error("Invalid or duplicate journey");
    ids.add(journey.id);
    if (journey.kind !== undefined && !["flow", "case"].includes(journey.kind)) throw Error("Invalid journey kind");
    if (!screens.has(journey.entry)) throw Error(`Journey entry missing: ${journey.entry}`);
    if (!Array.isArray(journey.steps) || !journey.steps.length || journey.steps.length > 100) throw Error(`Journey needs bounded steps: ${journey.id}`);
    for (const step of journey.steps) {
      if (!screens.has(step.screen)) throw Error(`Journey screen missing: ${step.screen}`);
      if (!step.title || !Array.isArray(step.actions) || !step.actions.length || step.actions.length > 20) throw Error("Journey step needs a title and actions");
      for (const action of step.actions) {
        if (!kinds.has(action.type)) throw Error(`Unsupported journey action: ${action.type}`);
        if (action.type === "fault") {
          if (!/^\/api\//.test(action.path || "") || action.path.length > 200 || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(action.method) || !Number.isInteger(action.count ?? 1) || (action.count ?? 1) < 1 || (action.count ?? 1) > 10) throw Error("Invalid synthetic request fault");
        } else if (typeof action.selector !== "string" || !action.selector || action.selector.length > 500) throw Error("Journey action needs a bounded selector");
        if (action.type === "file" && (typeof action.asset !== "string" || !action.asset.startsWith("./") || action.asset.includes(".."))) throw Error("Journey file must be a local synthetic asset");
      }
    }
  }
  return journeys;
}
