import { maskedSource } from './source-obligations.mjs';
import { objcTokens, isIdentifier } from './objc-source-model.mjs';

// This is a capability-closed data-declaration subset, not a Swift effect
// interpreter. Foreign files cannot introduce an object/controller capability,
// runtime alias, dynamic selector or unknown call into the Objective-C proof.
export function closedSwiftData(sources, objcClasses) {
  const files = sources.filter(s => s.path.endsWith('.swift'));
  const keywords = new Set('import Foundation objc class struct static public private internal final var let func override required init self super return if else for in do catch try as nil true false with'.split(' '));
  const data = new Set('String Int UInt Int8 Int16 Int32 Int64 UInt8 UInt16 UInt32 UInt64 Float Double Bool NSNumber Data NSCoding NSSecureCoding NSCoder NSKeyedArchiver AnyObject NSObject'.split(' '));
  const calls = new Set('String Int NSNumber Data init print forEach filter encode decodeObject decodeInteger decodeBool archivedData'.split(' '));
  const properties = new Set('count first value key forKey integerLiteral withRootObject requiringSecureCoding'.split(' '));
  if ([...data].some(name => objcClasses.has(name))) return false;
  const classes = new Set(), locals = new Set(), methods = new Set(), scalarBindings = new Set(), scalarReturns = new Set(), declarations = new Map(), inferred = new Set(), models = [];
  const scalar = '(?:String|Int|UInt|Int8|Int16|Int32|Int64|UInt8|UInt16|UInt32|UInt64|Float|Double|Bool|NSNumber|Data)';
  for (const file of files) {
    const clean = maskedSource(file.text), model = objcTokens(file.text);
    if (!model || /\bvalue\s*\(/.test(clean) || /#|\\|\b(?:extension|typealias|unsafeBitCast|Unmanaged|Unsafe\w*|Selector|NSSelectorFromString|setValue|setValuesForKeys|valueForKey|valueForKeyPath|perform|performSelector|selectedSegmentIndex)\b/.test(clean) || /\\\(|"""/.test(file.text)) return false;
    if ([...clean.matchAll(/\bimport\s+(\w+)/g)].some(m => m[1] !== 'Foundation') || /@objc\s*\(/.test(clean)) return false;
    for (const m of clean.matchAll(/\b(?:class|struct)\s+(\w+)\s*(?=[:{])/g)) {
      if (data.has(m[1]) || /^(?:NS|UI|BG)[A-Z]/.test(m[1]) || objcClasses.has(m[1]) || classes.has(m[1])) return false;
      classes.add(m[1]);
    }
    for (const m of clean.matchAll(/\b(?:var|let)\s+(\w+)(?:\s*:\s*(\w+))?/g)) { locals.add(m[1]); if (!m[2]) inferred.add(m[1]); }
    for (const m of clean.matchAll(/\b(\w+)\s*:\s*(\w+)/g)) { const types = declarations.get(m[1]) || new Set(); types.add(m[2]); declarations.set(m[1], types); }
    for (const m of clean.matchAll(/\bfunc\s+(\w+)/g)) methods.add(m[1]);
    for (const m of clean.matchAll(new RegExp('\\b(?:var|let)\\s+(\\w+)\\s*:\\s*' + scalar + '\\b', 'g'))) scalarBindings.add(m[1]);
    for (const m of clean.matchAll(new RegExp('\\bfunc\\s+(\\w+)\\s*\\([^)]*\\)\\s*->\\s*' + scalar + '\\b', 'g'))) scalarReturns.add(m[1]);
    for (const m of clean.matchAll(/\b(\w+)\s*:/g)) locals.add(m[1]);
    for (const m of clean.matchAll(/\(\s*(\w+)\s*\)\s+in\b/g)) locals.add(m[1]);
    models.push(model);
  }
  for (const name of scalarBindings) if (inferred.has(name) || [...(declarations.get(name) || [])].some(type => !new RegExp('^' + scalar + '$').test(type))) scalarBindings.delete(name);
  for (const name of scalarReturns) if (calls.has(name)) scalarReturns.delete(name);
  const allowed = new Set([...keywords, ...data, ...calls, ...properties, ...classes, ...locals, ...methods]);
  for (const model of models) for (let i = 0; i < model.tokens.length; i++) {
    const t = model.tokens, token = t[i];
    if (token.literal || !isIdentifier(token.value)) continue;
    if (!allowed.has(token.value)) return false;
    if (token.value === 'AnyObject') {
      const freshDictionary = t.slice(i-3,i+4).map(t=>t.value).join(' ') === '[ String : AnyObject ] ( )';
      let concreteCast = false;
      if (t[i-1]?.value === 'as') {
        concreteCast = scalarBindings.has(t[i-2]?.value);
        if (t[i-2]?.value === ')') {
          const open = model.pairs.get(i-2), producer = t[open-1]?.value;
          concreteCast = calls.has(producer) && ['String', 'Int', 'NSNumber', 'Data'].includes(producer) || scalarReturns.has(producer);
        }
      }
      if (!freshDictionary && !concreteCast) return false;
    }
    if (token.value === 'NSObject' && !(t[i - 1]?.value === ':' && t[i - 3]?.value === 'class')) return false;
    if (t[i + 1]?.value === '(' && !calls.has(token.value) && !classes.has(token.value) && !methods.has(token.value) && !keywords.has(token.value)) return false;
  }
  return true;
}
