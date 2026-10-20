import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { discoverUi } from './ui-discovery.mjs';
import { graphFlows } from './coverage.mjs';

const text = value => typeof value === 'string' && value.trim().length > 0;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const kinds = new Set(['screen', 'state', 'component', 'variant']);
function local(root, path) {
  if (!text(path) || isAbsolute(path)) throw Error('UI inventory must be a project-relative path');
  const result = resolve(root, path), rel = relative(root, result);
  if (rel === '..' || rel.startsWith('..' + sep)) throw Error('UI inventory leaves the project');
  return result;
}

export async function checkUiCoverage(project, root) {
  const config = project.uiCoverage;
  if (!config?.inventory) throw Error('UI delivery requires an independent UI inventory');
  const path = local(root, config.inventory), inv = JSON.parse(await readFile(path, 'utf8'));
  if (inv.version !== 1 || !Array.isArray(inv.files) || !Array.isArray(inv.anchors)) throw Error('UI delivery needs a generated UI worklist');
  const sourceRoot = resolve(dirname(path), inv.sourceRoot || '.');
  const fresh = await discoverUi(sourceRoot, { exclude: [relative(sourceRoot, path).split(sep).join('/')] });
  if (fresh.issues.length) throw Error('UI discovery has unresolved sources: ' + fresh.issues.map(row => row.path).join(', '));
  if (JSON.stringify(fresh.files) !== JSON.stringify(inv.files)) throw Error('UI source changed; reinspect affected screens and states');
  if (JSON.stringify(fresh.anchors) !== JSON.stringify(inv.anchors)) throw Error('UI discovery anchors changed; regenerate and inspect the UI worklist');
  const exclusions = new Map((inv.exclusionReviews || []).map(row => [row.id, row]));
  for (const row of fresh.exclusions) if (!text(exclusions.get(row.id)?.reason)) throw Error('Uninspected excluded source directory: ' + row.path);
  const states = new Map(), files = new Map(fresh.files.map(row => [row.path, row]));
  const catalog = new Map(project.catalog.map(row => [row.id, row]));
  for (const row of inv.states || []) {
    if (!/^[\w-]+$/.test(row.id || '') || states.has(row.id) || !kinds.has(row.kind) || !text(row.title) || !text(row.condition) || !text(row.pageId) || !text(row.feature) || !text(row.platform) || !text(row.layout)) throw Error('UI states need unique IDs, title, condition, page, feature, platform and layout');
    if (!Array.isArray(row.sources) || !row.sources.length || row.sources.some(path => !files.has(path))) throw Error('UI state has unscanned source: ' + row.id);
    if (row.status !== 'covered' || row.blocker || !Array.isArray(row.cases) || !row.cases.length) throw Error('Missing UI state: ' + row.id + (row.blocker ? ': ' + row.blocker : ''));
    for (const id of row.cases) {
      const screen = catalog.get(id);
      if (!screen) throw Error('UI state missing from canvas: ' + row.id + ':' + id);
      if (screen.pageId !== row.pageId || screen.feature !== row.feature) throw Error('UI state needs its actual page/feature group: ' + row.id);
    }
    states.set(row.id, row);
  }
  if (!states.size) throw Error('UI inventory has no discovered screens or states');
  const fileReviews = new Map();
  for (const row of inv.fileReviews || []) {
    if (!files.has(row.path) || fileReviews.has(row.path) || !text(row.summary) || !['ui', 'support', 'content', 'asset'].includes(row.role)) throw Error('Invalid or duplicate UI source-file review');
    const hasUi = fresh.anchors.some(anchor => anchor.path === row.path);
    if (hasUi && row.role !== 'ui') throw Error('UI source cannot be hidden as support: ' + row.path);
    if (row.role === 'ui' && (!Array.isArray(row.states) || !row.states.length || row.states.some(id => !states.get(id)?.sources.includes(row.path)))) throw Error('UI source has no related visible state: ' + row.path);
    fileReviews.set(row.path, row);
  }
  for (const file of files.keys()) if (!fileReviews.has(file)) throw Error('Uninspected UI source file: ' + file);
  const bindings = new Map(), exclusive = new Map();
  for (const row of inv.bindings || []) {
    const anchor = fresh.anchors.find(item => item.id === row.anchor);
    if (!anchor || bindings.has(row.anchor) || !Array.isArray(row.states) || !row.states.length || row.states.some(id => !states.get(id)?.sources.includes(anchor.path))) throw Error('UI anchor needs a unique, related state binding');
    bindings.set(row.anchor, row.states);
    if (anchor.kind === 'render-condition') {
      const key = anchor.path + ':' + anchor.offset, cases = new Set(row.states.flatMap(id => states.get(id).cases));
      const previous = exclusive.get(key);
      if (previous && [...cases].some(id => previous.has(id))) throw Error('Opposite UI conditions cannot share the same rendered case: ' + anchor.path + ':' + anchor.line);
      exclusive.set(key, cases);
    }
  }
  for (const row of fresh.anchors) if (!bindings.has(row.id)) throw Error('Unresolved UI surface: ' + row.path + ':' + row.line + ' ' + row.kind);
  const transitions = inv.transitions || [], edges = graphFlows(project), transitionIds = new Set();
  for (const row of transitions) {
    if (!text(row.id) || states.has(row.id) || transitionIds.has(row.id) || !states.has(row.from) || !states.has(row.to) || !['action', 'recovery', 'condition', 'reference'].includes(row.kind) || !text(row.label)) throw Error('UI transition needs unique ID, discovered states, kind and label');
    transitionIds.add(row.id);
    const from = states.get(row.from).cases, to = states.get(row.to).cases;
    if (!edges.some(edge => from.includes(edge.from) && to.includes(edge.to) && (edge.kind || 'action') === row.kind)) throw Error('Missing canvas flow link: ' + row.from + ' -> ' + row.to);
    if (['action', 'recovery'].includes(row.kind) && states.get(row.to).platform === 'web') {
      const journey = project.journeys?.find(item => item.id === row.journey && item.kind !== 'case');
      let previous = journey?.entry, matched = false;
      for (const step of journey?.steps || []) {
        if (from.includes(previous) && to.includes(step.screen) && step.actions.some(action => ['click', 'fill', 'check', 'select', 'file'].includes(action.type)) && step.actions.some(action => action.type === 'expect')) matched = true;
        previous = step.screen;
      }
      if (!matched) throw Error('UI action needs a checked continuing journey: ' + row.id);
    }
  }
  const seenCases = new Set([...states.values()].flatMap(row => row.cases));
  for (const id of catalog.keys()) if (!seenCases.has(id)) throw Error('Canvas case has no discovered UI state: ' + id);
  const requiredEvidence = Object.create(null);
  for (const row of states.values()) for (const id of row.cases) (requiredEvidence[id] ||= []).push({ id: row.id, platform: row.platform });
  for (const row of transitions.filter(row => ['action', 'recovery'].includes(row.kind))) {
    const target = states.get(row.to);
    for (const id of target.cases) requiredEvidence[id].push({ id: row.id, platform: target.platform });
  }
  let audit = { status: 'not-requested' };
  if (project.sourceCoverage?.inventory) {
    const raw = JSON.parse(await readFile(local(root, project.sourceCoverage.inventory), 'utf8'));
    const done = new Set((raw.reviews || []).map(row => row.id));
    const obligations = raw.obligations || [];
    audit = { status: 'not-verified', recorded: obligations.length, pending: obligations.filter(row => !done.has(row.id)).length, command: '--complete' };
  }
  return { files: files.size, screens: new Set([...states.values()].map(row => row.pageId)).size, states: states.size, cases: seenCases.size,
    anchors: fresh.anchors.length, transitions: transitions.length, sourceRoot: await realpath(sourceRoot),
    digest: hash({ files: fresh.files, anchors: fresh.anchors, states: inv.states, transitions, bindings: inv.bindings }), requiredEvidence, audit };
}
