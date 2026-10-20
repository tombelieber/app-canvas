import { maskedSource } from './source-obligations.mjs';

function hiddenLocalUse(project, method, name) {
  const definitions = new Map();
  for (const source of project.sources) {
    const clean = maskedSource(source.text.replace(/\\\r?\n/g, ' '));
    for (const m of clean.matchAll(/^\s*#\s*define\s+(\w+)([^\n]*)/gm)) {
      const bodies = definitions.get(m[1]) || []; bodies.push(m[2]); definitions.set(m[1], bodies);
    }
  }
  const visit = (macro, seen = new Set()) => {
    if (seen.has(macro)) return true;
    const next = new Set(seen).add(macro);
    return (definitions.get(macro) || []).some(body => {
      const identifiers = body.match(/\b[A-Za-z_]\w*\b/g) || [];
      return body.includes('#') || identifiers.includes(name) || identifiers.some(n => definitions.has(n) && visit(n, next));
    });
  };
  return method.model.tokens.slice(method.bodyStart, method.bodyEnd).some(t => definitions.has(t.value) && visit(t.value));
}

// Only an immutable Foundation property-list parse establishes these locals.
// The declaration must dominate the outer native read and remain in scope.
// Unknown assignments, aliases, pointer exports and executable macros do not
// inherit a declared NSDictionary type or an inventory annotation.
export function immutableLocalData(project, method, before) {
  const result = new Map(), { tokens: t, pairs } = method.model;
  const names = ['NSPropertyListSerialization', 'propertyListWithData', 'NSPropertyListImmutable'];
  if (names.some(n => project.macros.has(n)) || project.classes.has('NSPropertyListSerialization')) return result;
  if (project.globals.has(names[0]) || [...project.fields.values()].some(f => f.has(names[0])) ||
      project.methods.some(m => m.params.some(p => p.name === names[0]))) return result;
  if (project.files.some(f => f.model.tokens.some((token,i,a) => token.value === names[0] &&
      ['*','id','Class'].includes(a[i-1]?.value) && ['=', ';', ',', ')'].includes(a[i+1]?.value)))) return result;
  if (t.slice(method.bodyStart,method.bodyEnd).some(token => ['goto','setjmp','longjmp'].includes(token.value))) return result;
  for (let i = method.bodyStart; i < before; i++) {
    if (t[i].value !== 'NSDictionary' || t[i+1]?.value !== '*' || t[i+3]?.value !== '=') continue;
    if (!['{',';'].includes(t[i-1]?.value)) continue;
    const name = t[i+2].value;
    if (method.params.some(p => p.name === name) || project.fields.get(method.owner)?.has(name) || project.globals.has(name)) continue;
    if (hiddenLocalUse(project, method, name)) continue;
    let begin=i+4;
    if (t.slice(begin,begin+4).map(t=>t.value).join(' ') === '( NSDictionary * )') begin+=4;
    if (t[begin]?.value !== '[' || t[begin+1]?.value !== names[0]) continue;
    const end=pairs.get(begin); if(end===undefined || end>=before || t[end+1]?.value!==';') continue;
    const words=[];
    for(let j=begin+2;j<end;j++){
      if(['[','(','{'].includes(t[j].value)){j=pairs.get(j);continue;}
      if(t[j+1]?.value===':')words.push([t[j].value,j]);
    }
    if(words.map(([name])=>name).join(':')!=='propertyListWithData:options:format:error')continue;
    const options=words[1][1]+2;
    if(t[options]?.value!=='NSPropertyListImmutable'||options+1!==words[2][1])continue;
    // A declaration in a preceding conditional/block cannot be borrowed after
    // its scope has closed, and cannot dominate a sibling native guard.
    if([...pairs].some(([open,close])=>t[open]?.value==='{'&&open<i&&close>i&&close<before))continue;
    let safe=true;
    for(let j=method.bodyStart;j<method.bodyEnd;j++){
      if(t[j].value!==name||j===i+2)continue;
      const dictionaryRead=t[j-1]?.value==='['&&t[j+1]?.value==='objectForKey'&&t[j+2]?.value===':';
      const nilCheck=t[j-1]?.value==='!'&&t[j-2]?.value==='('&&t[j-3]?.value==='if'&&t[j+1]?.value===')';
      if(!dictionaryRead&&!nilCheck)safe=false;
    }
    if(safe)result.set(name,'DataValue');
  }
  return result;
}
