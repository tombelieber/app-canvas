import { closedSwiftData } from './objc-foreign-data.mjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { analyzeObjcNonRendering } from './objc-nonrendering.mjs';
import { concreteStringFields, directIvar } from './objc-field-origins.mjs';
import { nativeControlBindings, mainActionChain, isolatedClassSelectors } from './objc-control-bindings.mjs';
import { readonlyTextFields } from './objc-native-text-fields.mjs';
import { immutableLocalData } from './objc-local-data-origins.mjs';

function guards(method) {
  const { tokens: t, pairs } = method.model, result = [];
  for (let i = method.bodyStart; i < method.bodyEnd; i++) {
    if (t.slice(method.bodyStart, i).some((token, n) => {
      if (token.value !== '^') return false;
      let body = method.bodyStart + n + 1;
      if (t[body]?.value === '(') body = pairs.get(body) + 1;
      return t[body]?.value === '{' && pairs.get(body) > i;
    })) continue;
    if (t[i].value !== 'if' || t[i + 1]?.value !== '(') continue;
    const end = pairs.get(i + 1), expression = t.slice(i + 2, end).map(t => t.value);
    if (expression.length !== 5 || expression[1] !== '.' || expression[2] !== 'selectedSegmentIndex' || expression[3] !== '==' || expression[4] !== '0') continue;
    if (t[end + 1]?.value !== '{') continue;
    const close = pairs.get(end + 1); if (close === undefined) continue;
    const ranges = [{ begin: end + 2, end: close, value: true }];
    if (t[close + 1]?.value === 'else' && t[close + 2]?.value === '{') ranges.push({ begin: close + 3, end: pairs.get(close + 2), value: false });
    result.push({ index: i, offset: t[i].start, field: expression[0], ranges });
  }
  return result;
}

export function stableNativeGuards(sources, resources) {
  const analysis = analyzeObjcNonRendering(sources), { project } = analysis, proofs = [];
  if (!closedSwiftData(sources, project.classes) || project.incomplete || sources.some(s => !['.m', '.h', '.swift'].includes(extname(s.path).toLowerCase()))) return proofs;
  if (['if', 'else', 'IBOutlet', 'UISegmentedControl', 'selectedSegmentIndex'].some(name => project.macros.has(name))) return proofs;
  if (project.methods.some(m => /^UI[A-Z]/.test(m.owner) || ['NSString', 'NSMutableString'].includes(m.owner) && ['dealloc', 'retain', 'release', 'autorelease', 'doesNotRecognizeSelector:', 'methodForSelector:'].includes(m.selector))) return proofs;
  if (project.methods.some(m => ['selectedSegmentIndex', 'setSelectedSegmentIndex:', 'forwardInvocation:', 'resolveInstanceMethod:', 'resolveClassMethod:'].includes(m.selector))) return proofs;
  // A reflective dispatch through an unknown object can enter an action on
  // an unproved thread. A direct, unrelated source class receiver is distinct
  // from this instance-action domain; other targets remain unresolved.
  for (const file of project.files) {
    const t = file.model.tokens;
    if (t.some((token, i) => /^(?:performSelector|performSelectorOnMainThread|performSelectorInBackground)$/.test(token.value) &&
      t[i + 1]?.value === ':' && (t[i - 2]?.value !== '[' || !project.classes.has(t[i - 1]?.value)))) return proofs;
  }
  for (const method of project.methods) {
    const nodes = guards(method); if (nodes.length < 2) continue;
    if (project.files.some(f => f.model.tokens.some((t,i,a) => {
      const write = t.value === 'setSelectedSegmentIndex' && a[i+1]?.value === ':' ||
        t.value === 'selectedSegmentIndex' && ['=', '+=', '-=', '++', '--'].includes(a[i+1]?.value);
      if (!write) return false;
      const sourceOwner = f.methods.find(m => t.start >= m.start && t.start < m.end)?.owner;
      return !sourceOwner || sourceOwner === method.owner;
    }))) continue;
    if (project.macros.has(method.selector) || !isolatedClassSelectors(project, method.owner)) continue;
    if ([...project.parents].some(([, parents]) => parents.has(method.owner))) continue;
    const fields = concreteStringFields(project, method.owner); if (!fields.size) continue;
    for (const node of nodes) {
      if (project.macros.has(node.field) || !directIvar(project, method.owner, node.field, 'UISegmentedControl')) continue;
      const native = nativeControlBindings(resources, method.owner, node.field, new Set(fields.keys()), readonlyTextFields(project, method.owner));
      if (!native || !mainActionChain(project, method, native)) continue;
      const ancestors = nodes.filter(parent => parent !== node && parent.field === node.field).flatMap(parent => parent.ranges
        .filter(range => node.index >= range.begin && node.index < range.end).map(range => ({ parent, range }))).sort((a, b) => b.range.begin - a.range.begin);
      for (const { parent, range } of ancestors) {
        const data = new Map([...fields, ...immutableLocalData(project, method, parent.index)]);
        if (!analysis.interval(method, range.begin, node.index, data, native.textFields)) continue;
        proofs.push({ path: method.path, offset: node.offset, outcome: range.value ? 'false' : 'true', methodOffset: method.start,
          enclosingGuardOffset: parent.offset, intervalStart: method.model.tokens[range.begin]?.start, intervalEnd: node.offset });
        break;
      }
    }
  }
  return proofs;
}

export async function annotateStableNativeGuards(root, files, obligations) {
  const native = new Set(['.m', '.mm', '.h', '.c', '.cc', '.cpp', '.swift']);
  const selected = files.filter(f => native.has(extname(f.path).toLowerCase()) || ['.storyboard', '.xib'].includes(extname(f.path).toLowerCase()));
  if (!selected.some(f => f.path.endsWith('.storyboard'))) return;
  const values = await Promise.all(selected.map(async f => ({ ...f, text: await readFile(join(root, f.path), 'utf8') })));
  const proofs = stableNativeGuards(values.filter(f => native.has(extname(f.path).toLowerCase())), values.filter(f => !native.has(extname(f.path).toLowerCase())));
  const dependencyDigest = createHash('sha256').update(JSON.stringify(selected.map(f => [f.path, f.sha256]).sort())).digest('hex');
  for (const proof of proofs) {
    const obligation = obligations.find(o => o.path === proof.path && o.kind === 'branch' && o.offset === proof.offset && o.outcome === proof.outcome);
    if (!obligation || obligation.unreachable || obligation.nonRenderingOutcome) continue;
    const { path, offset, outcome, ...locations } = proof;
    obligation.nonRenderingOutcome = { kind: 'objc-stable-native-guard', ...locations, dependencyDigest,
      reason: 'A source-bound UIKit action repeats a native control guard after a closed synchronous data interval with unchanged receiver ownership. The contradictory outcome adds no reachable UI; the controller and reachable outcomes remain separately required.' };
  }
}
