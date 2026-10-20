// A bounded Interface Builder reader. Malformed/ambiguous metadata is opaque;
// it never guesses a native receiver from a property declaration alone.
export function nativeControlBindings(resources, owner, field, dataFields) {
  const bindings = [], actions = new Set(), delegates = new Set();
  for (const resource of resources) {
    if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/.test(resource.text)) return;
    const text = resource.text.replace(/<!--[\s\S]*?-->/g, ''), stack = [], nodes = [], ids = new Map();
    for (const match of text.matchAll(/<\/?([\w.:-]+)\b[^>]*>/g)) {
      const raw = match[0], tag = match[1];
      if (raw.startsWith('</')) { if (stack.pop()?.tag !== tag) return; continue; }
      const attributes = Object.create(null);
      for (const attr of raw.matchAll(/([\w.:-]+)="([^"]*)"/g)) {
        if (Object.hasOwn(attributes, attr[1])) return;
        attributes[attr[1]] = attr[2];
      }
      if (raw.slice(tag.length + 1).replace(/\/?>$/, '').replace(/\s+[\w.:-]+="[^"]*"/g, '').trim()) return;
      if (attributes.property?.includes('&') || attributes.keyPath?.includes('&')) return;
      if (attributes.customClass?.includes('&')) return;
      const node = { tag, attributes, parent: stack.at(-1), children: [] };
      node.parent?.children.push(node); nodes.push(node);
      if (attributes.id) { if (ids.has(attributes.id)) return; ids.set(attributes.id, node); }
      if (!raw.endsWith('/>')) stack.push(node);
    }
    if (stack.length) return;
    for (const node of nodes.filter(n => n.attributes.customClass === owner)) {
      if (node.tag !== 'viewController' || node.attributes.customModule) return;
      const connections = node.children.filter(n => n.tag === 'connections');
      if (connections.length !== 1) return;
      if (connections[0].children.some(o => dataFields.has(o.attributes.property))) return;
      const outlets = connections[0].children.filter(n => n.tag === 'outlet');
      const own = outlets.filter(o => o.attributes.property === field);
      if (own.length !== 1) return;
      const control = ids.get(own[0].attributes.destination);
      if (control?.tag !== 'segmentedControl' || control.attributes.customClass || control.attributes.customModule) return;
      bindings.push({ path: resource.path, sha256: resource.sha256 });
      const boundFields = nodes.filter(n => n.tag === 'textField' && !n.attributes.customClass && !n.attributes.customModule &&
        n.children.filter(c => c.tag === 'connections').flatMap(c => c.children).some(c => c.tag === 'outlet' &&
          c.attributes.property === 'delegate' && c.attributes.destination === node.attributes.id));
      if (boundFields.length) delegates.add('textFieldShouldReturn:');
      for (const n of nodes) if (n.tag === 'action' && n.attributes.destination === node.attributes.id) {
        const control = n.parent?.parent;
        if (n.parent?.tag !== 'connections' || !['button', 'segmentedControl', 'textField', 'switch', 'slider', 'stepper', 'datePicker', 'pageControl'].includes(control?.tag) ||
            control.attributes.customClass || control.attributes.customModule) return;
        actions.add(n.attributes.selector);
      }
      for (const n of nodes) if (n.tag === 'userDefinedRuntimeAttribute' &&
        [field, ...dataFields].includes(n.attributes.keyPath?.split('.').at(-1))) return;
    }
  }
  return bindings.length ? { bindings, actions, delegates } : undefined;
}

// The accepted action chain is source-bound, synchronous and unambiguous.
// An unbound selector, block invocation or external receiver stays pending.
export function mainActionChain(project, method, native, seen = new Set()) {
  const root = method.returnType === 'IBAction' && native.actions.has(method.selector) ||
    method.selector === 'textFieldShouldReturn:' && native.delegates.has(method.selector) &&
      method.returnType === 'BOOL' && method.params.length === 1 && method.params[0].type === 'UITextField';
  if (seen.has(method) || method.classMethod || method.selector.includes(':') && !root ||
      (project.byKey.get(`${method.owner}:-:${method.selector}`) || []).length !== 1 ||
      ['self', 'IBAction', 'BOOL', 'UITextField', method.selector.split(':')[0]].some(n => project.macros.has(n))) return false;
  const visited = new Set(seen).add(method), name = method.selector.split(':')[0];
  let callers = 0;
  for (const file of project.files) {
    const t = file.model.tokens;
    for (let i = 0; i < t.length; i++) if (t[i].value === name) {
      const own = file.methods.find(m => t[i].start >= m.start && t[i].start < m.end);
      if (own && t[i].start < t[own.bodyStart - 1].start) continue;
      if (!own && t[i - 1]?.value === ')' && [';', ':'].includes(t[i + 1]?.value)) continue;
      if (own?.owner !== method.owner || t[i - 2]?.value !== '[' || t[i - 1]?.value !== 'self') return false;
      const close = file.model.pairs.get(i - 2), parts = [];
      if (close === undefined) return false;
      for (let j = i; j < close; j++) {
        if (['[', '(', '{'].includes(t[j].value)) { j = file.model.pairs.get(j); continue; }
        if (t[j + 1]?.value === ':') parts.push(t[j].value + ':');
      }
      if ((parts.length ? parts.join('') : t[i].value) !== method.selector) return false;
      // A call textually inside a block is not admitted as a main UI action.
      for (let j = own.bodyStart; j < i; j++) if (t[j].value === '^') {
        let body = j + 1;
        if (t[body]?.value === '(') body = file.model.pairs.get(body) + 1;
        if (t[body]?.value === '{' && file.model.pairs.get(body) > i) return false;
      }
      if (!mainActionChain(project, own, native, visited)) return false;
      callers++;
    }
  }
  return callers > 0 || root;
}

// A selector made from data is admitted only when its entire local lifetime
// stays in direct messages to an unrelated, statically named source class.
// Timers, threads, aliases, parameters and escaped selector values are opaque.
export function isolatedClassSelectors(project, owner) {
  const inherits = (a, b, seen = new Set()) => a === b || !seen.has(a) && [...(project.parents.get(a) || [])]
    .some(p => inherits(p, b, new Set(seen).add(a)));
  for (const file of project.files) {
    const t = file.model.tokens;
    for (let i = 0; i < t.length; i++) if (t[i].value === 'NSSelectorFromString') {
      const method = file.methods.find(m => t[i].start >= m.start && t[i].start < m.end);
      const name = t[i - 2]?.value;
      if (!method || t[i - 3]?.value !== 'SEL' || t[i - 1]?.value !== '=' || project.macros.has('SEL')) return false;
      let uses = 0;
      for (let j = method.bodyStart; j < method.bodyEnd; j++) if (t[j].value === name && j !== i - 2) {
        const target = t[j - 3]?.value, selector = t[j - 2]?.value;
        if (t[j - 4]?.value !== '[' || t[j - 1]?.value !== ':' || t[j + 1]?.value !== ']' ||
            !['respondsToSelector', 'performSelector'].includes(selector) || !project.classes.has(target) ||
            inherits(target, owner) || inherits(owner, target) || project.macros.has(target) || project.macros.has(selector) ||
            project.methods.some(m => m.owner === target && m.selector === selector + ':')) return false;
        uses++;
      }
      if (!uses) return false;
    }
  }
  return true;
}
