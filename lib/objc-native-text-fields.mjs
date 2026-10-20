import { indirectWrite } from './objc-field-origins.mjs';
import { maskedSource } from './source-obligations.mjs';

// A declaration alone never creates a native capability. The resource reader
// must additionally bind this strong slot to plain UITextField objects in every
// source scene. Only direct text reads are supported; app writes/escapes stay
// opaque. UIKit's valid text API and main-thread contract remain prerequisites.
export function readonlyTextFields(project, owner) {
  const result = new Set();
  if (['UITextField', 'IBOutlet', 'text'].some(n => project.macros.has(n)) || project.classes.has('UITextField')) return result;
  const stringParents = new Set(['NSString', 'NSMutableString', 'NSAttributedString', 'NSMutableAttributedString']);
  if ([...project.parents.values()].some(parents => [...parents].some(p => stringParents.has(p)))) return result;
  const fields = [...(project.fields.get(owner) || [])].filter(([, type]) => type === 'UITextField');
  for (const [name] of fields) {
    if (project.globals.has(name) || project.macros.has(name) || indirectWrite(project, new Set([name, 'text']), owner)) continue;
    if (project.methods.some(m => m.owner === owner && [name, `set${name[0].toUpperCase()}${name.slice(1)}:`].includes(m.selector))) continue;
    let declarations = 0, safe = true;
    for (const file of project.files) {
      const t = file.model.tokens; let lexicalOwner;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const clean = maskedSource(file.text.replace(/\\\r?\n/g, ' '));
      const own = [...clean.matchAll(new RegExp(`@(?:interface|implementation)\\s+${owner}\\b[\\s\\S]*?@end`, 'g'))].map(m => m[0]).join('\n');
      if (new RegExp(`@(?:property|synthesize)[^;]*\\b${escaped}\\b`).test(own) || new RegExp(`#\\s*define[^\\n]*\\b${escaped}\\b`).test(clean)) safe = false;
      for (let i = 0; i < t.length; i++) {
        if (['valueForKey', 'valueForKeyPath'].includes(t[i].value) && t[i + 1]?.value === ':') {
          let key;
          if (t[i + 2]?.value === 'objc-string') {
            try { key = JSON.parse(file.text.slice(t[i + 2].start + 1, t[i + 2].end)); } catch { /* opaque */ }
          }
          if (!key || key.split('.').includes(name)) safe = false;
        }
        if (t[i].value === '@' && ['interface', 'implementation'].includes(t[i + 1]?.value)) lexicalOwner = t[i + 2]?.value;
        if (t[i].value === '@' && t[i + 1]?.value === 'end') lexicalOwner = undefined;
        if (t[i].value !== name) continue;
        const method = file.methods.find(m => t[i].start >= m.start && t[i].start < m.end);
        if (method?.owner !== owner && lexicalOwner !== owner) {
          // Unrelated classes can have their own same-named ivar. Qualified
          // access through another receiver is not such a lexical binding.
          if (method && project.fields.get(method.owner)?.has(name) && !['.', '->', '&'].includes(t[i - 1]?.value)) continue;
          if (!method && lexicalOwner && project.fields.get(lexicalOwner)?.has(name)) continue;
          safe = false; continue;
        }
        if (method) {
          if (method.params.some(p => p.name === name) || ['.', '->', '&', '++', '--'].includes(t[i - 1]?.value)) { safe = false; continue; }
          const writes = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '++', '--']);
          const dotRead = t[i + 1]?.value === '.' && t[i + 2]?.value === 'text' && !writes.has(t[i + 3]?.value);
          const messageRead = t[i - 1]?.value === '[' && t[i + 1]?.value === 'text' && t[i + 2]?.value === ']';
          if (!dotRead && !messageRead) safe = false;
          continue;
        }
        if (t.slice(i - 3, i + 2).map(t => t.value).join(' ') !== `IBOutlet UITextField * ${name} ;`) { safe = false; continue; }
        let begin = i - 3;
        while (begin > 0 && ![';', '{', '}'].includes(t[begin - 1].value)) begin--;
        if (t.slice(begin, i).some(t => ['property', '__weak', '__unsafe_unretained', 'public'].includes(t.value))) safe = false;
        declarations++;
      }
    }
    if (safe && declarations === 1) result.add(name);
  }
  return result;
}
