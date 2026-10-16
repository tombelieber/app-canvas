import { validateJourneys } from "./journeys.mjs";
import { outcomes, transitionKinds, validateCoverage } from "./coverage.mjs";
export function localOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw Error("Preview requires a loopback HTTP URL");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw Error("Preview requires a loopback HTTP URL without credentials");
  return url.origin;
}
export function validateProject(project) {
  if (
    !project?.title ||
    !Array.isArray(project.catalog) ||
    !project.catalog.length ||
    !Array.isArray(project.groups)
  )
    throw Error("Project needs title, groups and an explicit screen catalog");
  const groups = new Set(project.groups.map((g) => g.id)),
    ids = new Set();
  for (const s of project.catalog) {
    if (!/^[a-zA-Z0-9_-]+$/.test(s.id || ""))
      throw Error(`Invalid screen id ${s.id}`);
    if (ids.has(s.id)) throw Error(`Duplicate screen ${s.id}`);
    ids.add(s.id);
    if (!groups.has(s.group) || !s.title)
      throw Error(`Invalid group or title for ${s.id}`);
    if (s.outcome !== undefined && !Object.hasOwn(outcomes, s.outcome)) throw Error(`Invalid outcome for ${s.id}`);
    if (
      s.viewport &&
      (!Number.isInteger(s.viewport.width) ||
        s.viewport.width < 200 ||
        s.viewport.width > 2400 ||
        !Number.isInteger(s.viewport.height) ||
        s.viewport.height < 200 ||
        s.viewport.height > 4000)
    )
      throw Error(`Invalid viewport for ${s.id}`);
  }
  for (const edge of project.flows || []) {
    if (edge.kind !== undefined && !transitionKinds.has(edge.kind)) throw Error(`Invalid transition kind: ${edge.kind}`);
    for (const id of [edge.from, edge.to])
      if (!ids.has(id)) throw Error(`Flow references missing screen ${id}`);
  }
  validateJourneys(project.journeys, ids);
  validateCoverage(project);
  const colors = ["#476c89", "#8a5d9b", "#4e826b", "#ab7452"];
  return {
    ...project,
    groups: project.groups.map((g, i) => ({
      ...g,
      title: g.title || g.label || g.id,
      color: g.color || colors[i % colors.length],
    })),
    flows: project.flows || [],
  };
}
export const publicProject = (project) => ({
  title: project.title,
  groups: project.groups,
  catalog: project.catalog.map(
    ({ id, title, group, source, viewport, experimental, outcome, condition }) => ({
      id,
      title,
      group,
      source,
      viewport: viewport || project.viewport,
      experimental,
      outcome,
      condition,
    }),
  ),
  flows: project.flows,
  links: project.links,
  journeys: project.journeys || [],
  coverage: project.coverage,
});
