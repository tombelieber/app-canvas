import { primitiveFunctions } from './objc-effect-models.mjs';
import { isIdentifier } from './objc-source-model.mjs';
import { maskedSource } from './source-obligations.mjs';

const unsafeRuntime = /\b(?:methodForSelector|sel_registerName|sel_getUid|class_getMethodImplementation|method_getImplementation|imp_implementationWithBlock|object_getIvar|__builtin_memcpy|__builtin_memmove|__builtin_memset|object_setIvar|object_setIvarWithStrongDefault|class_getInstanceVariable|ivar_getOffset|objc_msgSend|NSInvocation|NSGetUncaughtExceptionHandler|NSSetUncaughtExceptionHandler|memcpy|memmove|memset|bcopy)\b/;
const escapedLiteral = (source, token) => {
  if (token?.value !== 'objc-string') return;
  try { return JSON.parse(source.slice(token.start + 1, token.end)); } catch { return; }
};

// These are producer identities, never conclusions drawn from a declared type.
// Arguments are evaluated before the guarded interval; the result is a fresh
// Foundation string or nil. Unknown factories and casts do not establish it.
function stringProducer(model, begin, end) {
  const t = model.tokens, values = t.slice(begin, end).map(t => t.value);
  if (values.length === 1 && ['nil', 'objc-string'].includes(values[0])) return true;
  if (t[begin]?.value !== '[' || model.pairs.get(begin) !== end - 1) return false;
  if (values[1] === 'NSString' && values[2] === 'stringWithFormat' && values[3] === ':') {
    for (let i = begin + 4; i < end - 1; i++) {
      if (['[', '(', '{'].includes(t[i].value)) { i = model.pairs.get(i); continue; }
      if (isIdentifier(t[i].value) && t[i + 1]?.value === ':') return false;
    }
    return true;
  }
  if (values.slice(0, 7).join(' ') !== '[ [ NSString alloc ] initWithUTF8String :' || model.pairs.get(begin + 1) !== begin + 4) return false;
  for (let i = begin + 7; i < end - 1; i++) {
    if (['[', '(', '{'].includes(t[i].value)) { i = model.pairs.get(i); continue; }
    if (isIdentifier(t[i].value) && t[i + 1]?.value === ':') return false;
  }
  return true;
}

function statementEnd(model, begin) {
  const t = model.tokens;
  for (let i = begin; i < t.length; i++) {
    if (['[', '(', '{'].includes(t[i].value)) { const end = model.pairs.get(i); if (end === undefined) return; i = end; }
    else if (t[i].value === ';') return i;
    else if (t[i].value === '}') return;
  }
}

function indirectWrite(project, fields, owner) {
  const inherits = (a, b, seen = new Set()) => a === b || !seen.has(a) && [...(project.parents.get(a) || [])]
    .some(p => inherits(p, b, new Set(seen).add(a)));
  const related = other => inherits(owner, other) || inherits(other, owner);
  for (const source of project.sources) {
    const clean = maskedSource(source.text);
    if (unsafeRuntime.test(clean) || /\(\s*(?:id|Class)\s*\*\s*\)/.test(clean)) return true;
    // Raw object aliases are opaque. A bridge of an unrelated class's self
    // cannot alias this owner; every other bridge/export stays unresolved.
    const file = project.files.find(f => f.path === source.path);
    for (const match of clean.matchAll(/__bridge(?:_retained|_transfer)?\s+(?:void|char)\s*\*[^)]*\)\s*(\w+)/g)) {
      const method = file?.methods.find(m => match.index >= m.start && match.index < m.end);
      if (!method || related(method.owner) || match[1] !== 'self') return true;
    }
    for (const match of clean.matchAll(/\(\s*(?:void|char)\s*\*\s*\)\s*(\w+)/g)) {
      const method = file?.methods.find(m => match.index >= m.start && match.index < m.end);
      if (!method || related(method.owner) || match[1] !== 'self') return true;
    }
    const pasted = [...source.text.matchAll(/^\s*#\s*define\s+(\w+)[^\n]*##/gm)].map(m => m[1]);
    if (pasted.some(name => project.methods.some(m => m.owner === owner && m.model.tokens.slice(m.bodyStart, m.bodyEnd).some(t => t.value === name)))) return true;
  }
  for (const file of project.files) {
    const t = file.model.tokens;
    for (let i = 0; i < t.length; i++) {
      if (isIdentifier(t[i].value) && t[i+1]?.value === '(') {
        const close = file.model.pairs.get(i+1), args = t.slice(i+2, close), method = file.methods.find(m => t[i].start >= m.start && t[i].start < m.end);
        if (project.macros.has(t[i].value) && args.some(t => fields.has(t.value) || method?.owner === owner && t.value === 'self')) return true;
        const known = ['dispatch_async', 'dispatch_sync', 'dispatch_after'].includes(t[i].value) && args.some(t => t.value === '^') || primitiveFunctions.has(t[i].value) || /^(?:CGRect|CGPoint|CGSize|UIEdgeInsets)Make$/.test(t[i].value) || ['if','for','while','switch','sizeof'].includes(t[i].value);
        if (!known && method?.owner === owner && args.some(t => t.value === 'self')) return true;
      }
      if (t[i].value === 'bzero') {
        const method = file.methods.find(m => t[i].start >= m.start && t[i].start < m.end);
        const name = t[i + 3]?.value;
        const exact = t.slice(i, i + 11).map(t => t.value).join(' ') === `bzero ( & ${name} , sizeof ( ${name} ) ) ;`;
        const local = method && t.slice(method.bodyStart, i).some((token, n, before) => token.value === 'struct' &&
          isIdentifier(before[n + 1]?.value) && before[n + 2]?.value === name && before[n + 3]?.value === ';');
        if (!exact || !local || fields.has(name)) return true;
      }
      if (['setValue', 'setValueForKey', 'setValuesForKeysWithDictionary', 'setValueForKeyPath'].includes(t[i].value) && t[i + 1]?.value === ':') {
        // A dynamic KVC target/key could reach an ivar without an assignment.
        // Only a literal unrelated final key is outside this field set.
        let key; const keywords = [];
        const end = [...file.model.pairs].filter(([open, close]) => open < i && close > i && t[open]?.value === '[').sort((a, b) => b[0] - a[0])[0]?.[1];
        for (let j = i + 2; j < (end ?? i + 2); j++) {
          if (['[', '(', '{'].includes(t[j].value)) { j = file.model.pairs.get(j); continue; }
          if (isIdentifier(t[j].value) && t[j + 1]?.value === ':') keywords.push(t[j].value);
          if (['forKey', 'forKeyPath'].includes(t[j].value) && t[j + 1]?.value === ':') key = escapedLiteral(file.text, t[j + 2]);
        }
        const selector = [t[i].value, ...keywords].map(name => name + ':').join('');
        if (!['setValue:forKey:', 'setValue:forKeyPath:', 'setValuesForKeysWithDictionary:', 'setValueForKey:', 'setValueForKeyPath:'].includes(selector)) continue;
        if (!key || fields.has(key.split('.').at(-1))) return true;
      }
      if (fields.has(t[i].value) && ['&', '->'].includes(t[i - 1]?.value)) return true;
      if (fields.has(t[i].value) && ['++', '--', '+=', '-='].includes(t[i + 1]?.value)) return true;
    }
  }
  return false;
}

export function concreteStringFields(project, owner) {
  if (project.globals.has('NSString') || [...project.fields.values()].some(f => f.has('NSString')) || project.methods.some(m => m.params.some(p => p.name === 'NSString'))) return new Map();
  if (project.files.some(f => f.model.tokens.some((t,i,a) => t.value === 'NSString' && ['*', 'id', 'Class'].includes(a[i-1]?.value) && ['=', ';', ',', ')'].includes(a[i+1]?.value)))) return new Map();
  if (['NSString', 'alloc', 'initWithUTF8String', 'stringWithFormat'].some(name => project.macros.has(name)) || project.parents.has('NSString')) return new Map();
  const own = project.fields.get(owner) || new Map(), candidates = new Set([...own].filter(([, type]) => type === 'NSString').map(([name]) => name));
  if (!candidates.size || indirectWrite(project, candidates, owner)) return new Map();
  const safe = new Set(candidates), written = new Set();
  for (const file of project.files) {
    const t = file.model.tokens; let lexicalOwner;
    for (let i = 0; i < t.length; i++) {
      if (t[i].value === '@' && ['interface','implementation'].includes(t[i+1]?.value)) lexicalOwner = t[i+2]?.value;
      if (t[i].value === '@' && t[i+1]?.value === 'end') lexicalOwner = undefined;
      const name = t[i].value;
      if (!candidates.has(name) || t[i + 1]?.value !== '=') continue;
      const method = file.methods.find(m => t[i].start >= m.start && t[i].start < m.end);
      if (method?.owner !== owner) {
        // A qualified access can be an external write to this class. A local
        // same-named binding in another class is conservatively unresolved.
        if (lexicalOwner === owner || ['.', '->'].includes(t[i - 1]?.value)) safe.delete(name);
        continue;
      }
      if (method.params.some(p => p.name === name)) { safe.delete(name); continue; }
      const end = statementEnd(file.model, i + 2);
      if (end === undefined || !stringProducer(file.model, i + 2, end)) safe.delete(name);
      written.add(name);
    }
    // Executable macros, synthesized accessors, explicit setters and outlet
    // injection must not introduce an uninspected writer for these fields.
    for (const name of candidates) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const clean = maskedSource(file.text.replace(/\\\r?\n/g, ' '));
      const ownDeclarations = [...clean.matchAll(new RegExp(`@(?:interface|implementation)\\s+${owner}\\b[\\s\\S]*?@end`, 'g'))].map(m => m[0]).join('\n');
      if (new RegExp(`(?:@property[^;]*\\b${escaped}\\b|@synthesize[^;]*\\b${escaped}\\b)`).test(ownDeclarations) ||
          new RegExp(`#\\s*define[^\\n]*\\b${escaped}\\b`).test(clean)) safe.delete(name);
      if (project.methods.some(m => m.owner === owner && m.selector === `set${name[0].toUpperCase()}${name.slice(1)}:`)) safe.delete(name);
    }
  }
  return new Map([...safe].filter(name => written.has(name)).map(name => [name, 'NSString']));
}

export function directIvar(project, owner, name, type) {
  if (!isIdentifier(name) || project.fields.get(owner)?.get(name) !== type || indirectWrite(project, new Set([name, 'selectedSegmentIndex']), owner)) return false;
  if (project.sources.some(s => new RegExp(`#\\s*define[^\\n]*\\b${name}\\b`).test(maskedSource(s.text)))) return false;
  let count = 0;
  for (const file of project.files) {
    const t = file.model.tokens; let scopeOwner;
    for (let i = 0; i < t.length; i++) {
      if (t[i].value === '@' && ['interface', 'implementation'].includes(t[i + 1]?.value)) scopeOwner = t[i + 2]?.value;
      if (t[i].value === '@' && t[i + 1]?.value === 'end') scopeOwner = undefined;
      if (t[i].value !== name) continue;
      const method = file.methods.find(m => t[i].start >= m.start && t[i].start < m.end);
      if (method) {
        if (method.owner !== owner || method.params.some(p => p.name === name)) return false;
        if (t[i + 1]?.value === '.' && t[i + 2]?.value === 'selectedSegmentIndex' && !['=', '+=', '-=', '++', '--'].includes(t[i + 3]?.value)) continue;
        if (t[i - 1]?.value === '[' && t[i + 1]?.value === 'setTitleTextAttributes' && !project.macros.has('setTitleTextAttributes')) continue;
        return false;
      }
      if (['&', '->', '.'].includes(t[i - 1]?.value)) return false;
      if (!method && scopeOwner === owner && t.slice(i - 3, i + 2).map(t => t.value).join(' ') === `IBOutlet ${type} * ${name} ;`) {
        let begin = i - 3;
        while (begin > 0 && ![';', '{', '}'].includes(t[begin - 1].value)) begin--;
        if (t.slice(begin, i).some(t => ['property', '__weak', '__unsafe_unretained'].includes(t.value))) return false;
        count++;
      }
    }
  }
  return count === 1;
}
