// A canonical Objective-C initializer's nil return constructs no UI object.
// Keep the outcome in the worklist, but permit a specific non-UI explanation.
// A fallback/else, later mutation or ordinary self guard is not this pattern.
export function annotateConstructionOutcomes(source, obligations) {
  function closing(open) {
    let depth = 1;
    for (let index = open + 1; index < source.length; index++) {
      if (source[index] === '{') depth++;
      if (source[index] === '}' && --depth === 0) return index;
    }
    return -1;
  }
  for (const method of source.matchAll(/^\s*-\s*\(\s*(?:instancetype|id)\s*\)\s*init(?=[^a-z]|$)[^{;]*\{/gm)) {
    const open = method.index + method[0].lastIndexOf('{'), end = closing(open);
    if (end < 0) continue;
    const body = source.slice(open + 1, end);
    const prefix = body.match(/^\s*self\s*=\s*\[\s*super\s+init(?:[A-Z][A-Za-z0-9_]*)?\b[^\[\]]*\]\s*;\s*(if)\s*\(\s*self\s*\)\s*\{/);
    if (!prefix) continue;
    const guardOpen = open + 1 + prefix[0].lastIndexOf('{'), guardEnd = closing(guardOpen);
    if (guardEnd < 0 || !/^\s*return\s+self\s*;\s*$/.test(source.slice(guardEnd + 1, end))) continue;
    const offset = open + 1 + prefix[0].lastIndexOf('if');
    const outcome = obligations.find(item => item.kind === 'branch' && item.offset === offset && item.outcome === 'false');
    if (outcome) outcome.nonRenderingOutcome = { reason: 'canonical initializer returns nil without constructing or presenting a UI object' };
  }
}
