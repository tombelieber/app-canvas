import { createHash } from 'node:crypto';

function stable(value, seen = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || seen.has(value) || ![Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(value))) throw Error('Population inputs must be finite, acyclic JSON data');
  if (Object.getOwnPropertySymbols(value).length || Array.isArray(value) && Array.from({ length: value.length }, (_, index) => index).some(index => !Object.hasOwn(value, index))) throw Error('Population inputs must be finite, acyclic JSON data');
  const next = new Set(seen).add(value);
  return Array.isArray(value) ? value.map(row => stable(row, next)) : Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key], next)]));
}
export const populationFingerprint = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

// Plan before running devices. A changed lifecycle, error outcome, locale,
// fixture, source/build or logical viewport is a different capture input.
// Observation requests can be unioned without creating another UI state.
export function planCaptures(requests) {
  const jobs = new Map(), cases = new Set(), groups = new Map();
  for (const row of requests) {
    if (!row.caseId || cases.has(row.caseId) || !row.stateId || !row.pageId || !row.feature || !row.entry || !row.platform || !row.layout || !row.locale || !row.sourceDigest || !row.buildFingerprint || !row.viewport || !row.inputs || !Array.isArray(row.steps)) throw Error('Capture requests need unique cases, semantic state/group and complete original-runtime inputs');
    cases.add(row.caseId);
    const { caseId, pageId, feature, observe = [], ...inputs } = row;
    if (!Array.isArray(observe) || observe.some(value => typeof value !== 'string' || !value.trim())) throw Error('Capture observations must be named read-only getters');
    const key = populationFingerprint(inputs), job = jobs.get(key) || { key, ...inputs, pageId, feature, caseIds: [], observe: [] };
    if (job.pageId !== pageId || job.feature !== feature) throw Error('Equivalent captures cannot change their page/feature ownership');
    job.caseIds.push(caseId); job.observe = [...new Set([...job.observe, ...observe])].sort(); jobs.set(key, job);
    const groupKey = pageId + ':' + feature;
    if (!groups.has(groupKey)) groups.set(groupKey, { pageId, feature, states: new Set(), cases: [] });
    groups.get(groupKey).states.add(row.stateId); groups.get(groupKey).cases.push(caseId);
  }
  const planned = [...jobs.values()];
  return { cases: cases.size, captures: jobs.size, reused: cases.size - jobs.size, jobs: planned,
    surfaces: planned.map(job => ({ caseId: job.caseIds[0], stateId: job.stateId, pageId: job.pageId, feature: job.feature, platform: job.platform, layout: job.layout, evidenceCases: job.caseIds })),
    caseMap: Object.fromEntries(planned.flatMap(job => job.caseIds.map(id => [id, job.caseIds[0]]))),
    groups: [...groups.values()].map(row => ({ ...row, states: row.states.size })) };
}
