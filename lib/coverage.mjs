// Shared by the CLI gate and the browser. Coverage means authored cases, not
// inferred reachability or proof about an application's production backend.
export const outcomes = { neutral: "一般", success: "成功", failure: "失敗", pending: "等待", warning: "注意" };
export const transitionKinds = new Set(["action", "condition", "recovery", "reference"]);

export function graphFlows(project) {
  const result = (project.flows || []).map(f=>({...f}));
  const states = new Map(project.catalog.map(s=>[s.id,s]));
  for (const journey of project.journeys || []) {
    let from = journey.entry;
    for (const step of journey.steps) {
      if (from !== step.screen) {
        const existing = result.find(f=>f.from===from&&f.to===step.screen);
        const edge = { from, to: step.screen, label: step.title, kind: states.get(from)?.outcome === "failure" && states.get(step.screen)?.outcome !== "failure" ? "recovery" : "action" };
        if (!existing) result.push(edge);
        else if (["condition", "reference"].includes(existing.kind)) Object.assign(existing,edge);
      }
      from = step.screen;
    }
  }
  return result;
}

export function caseCoverage(project) {
  const cases = (project.journeys || []).filter(j => j.kind === "case");
  const checked = new Set(cases.filter(j => j.steps.some(s => s.screen === j.entry && s.actions.some(a => a.type === "expect"))).map(j => j.entry));
  const missing = project.catalog.filter(s => !checked.has(s.id)).map(s => s.id);
  const adjacent = new Map(project.catalog.map(s => [s.id, new Set()]));
  for (const f of graphFlows(project)) { adjacent.get(f.from)?.add(f.to); adjacent.get(f.to)?.add(f.from); }
  const visited = new Set(), pending = project.catalog.length ? [project.catalog[0].id] : [];
  while (pending.length) { const id = pending.pop(); if (visited.has(id)) continue; visited.add(id); pending.push(...(adjacent.get(id) || [])); }
  return { checked: checked.size, total: project.catalog.length, missing, disconnected: project.catalog.filter(s => !visited.has(s.id)).map(s => s.id), flows: (project.journeys || []).filter(j=>j.kind !== "case").length, cases: cases.length };
}

export function validateCoverage(project) {
  const report = caseCoverage(project);
  if (project.coverage?.requireAllCases && report.missing.length) throw Error(`Missing checked playable case: ${report.missing.join(", ")}`);
  if (project.coverage?.requireConnected && report.disconnected.length) throw Error(`Disconnected state graph: ${report.disconnected.join(", ")}`);
  return report;
}
