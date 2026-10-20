import { maskedSource } from "./source-obligations.mjs";

const identifier = /^[A-Za-z_]\w*$/;
const scalars = new Set("void BOOL Boolean bool char int short long float double NSInteger NSUInteger NSTimeInterval sqlite3 sqlite3_stmt dispatch_queue_t sqlite_int64 size_t".split(" "));
export const isIdentifier = value => identifier.test(value || "");
export const scalarType = type => scalars.has(type);

function withoutDirectives(source) {
  let continuation = false;
  return source.split("\n").map(line => {
    const directive = continuation || /^\s*#/.test(line);
    continuation = directive && /\\\s*$/.test(line);
    return directive ? line.replace(/./g, " ") : line;
  }).join("\n");
}

// This intentionally recognizes a bounded source subset. Unsupported tokens and
// declarations never become evidence of a non-rendering native method.
export function objcTokens(source) {
  source = withoutDirectives(source);
  const pattern = /\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*|@?"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[A-Za-z_]\w*|(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?[fFulL]*|->|==|!=|>=|<=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|\.\.\.|[^\s]/gy;
  const tokens = [];
  for (let offset = 0; offset < source.length;) {
    pattern.lastIndex = offset;
    const value = pattern.exec(source)?.[0];
    if (!value) return;
    const start = offset; offset += value.length;
    if (/^\s|^\/\*|^\/\//.test(value)) continue;
    const literal = /^@?"|^'/.test(value);
    tokens.push({ value: literal ? (value.startsWith("@") ? "objc-string" : value.startsWith("'") ? "character" : "c-string") : value,
      literal, start, end: offset });
  }
  const pairs = new Map(), stack = [], closing = { ")": "(", "]": "[", "}": "{" };
  for (let i = 0; i < tokens.length; i++) {
    const value = tokens[i].value;
    if (["(", "[", "{"].includes(value)) stack.push(i);
    if (closing[value]) {
      const open = stack.pop();
      if (open === undefined || tokens[open].value !== closing[value]) return;
      pairs.set(open, i); pairs.set(i, open);
    }
  }
  if (stack.length) return;
  return { tokens, pairs };
}

function argumentType(tokens) {
  if (tokens.some(t => t.value === "^")) return "block";
  const names = tokens.map(t => t.value).filter(isIdentifier).filter(v => !["const", "nullable", "nonnull", "__nullable", "__nonnull", "__kindof"].includes(v));
  return names[0] || "unknown";
}

function signature(model, index, owner) {
  const { tokens: t, pairs } = model;
  if (!["-", "+"].includes(t[index]?.value) || t[index + 1]?.value !== "(") return;
  const returnEnd = pairs.get(index + 1); if (returnEnd === undefined) return;
  const result = argumentType(t.slice(index + 2, returnEnd));
  let at = returnEnd + 1, selector = "", params = [];
  if (!isIdentifier(t[at]?.value)) return;
  if (t[at + 1]?.value !== ":") { selector = t[at++].value; }
  else for (;;) {
    if (!isIdentifier(t[at]?.value) || t[at + 1]?.value !== ":" || t[at + 2]?.value !== "(") return;
    selector += t[at].value + ":";
    const end = pairs.get(at + 2); if (end === undefined || !isIdentifier(t[end + 1]?.value)) return;
    params.push({ type: argumentType(t.slice(at + 3, end)), name: t[end + 1].value });
    at = end + 2;
    if (t[at]?.value === "{") break;
  }
  if (t[at]?.value !== "{") return;
  const end = pairs.get(at); if (end === undefined) return;
  return { owner, selector, params, returnType: result, classMethod: t[index].value === "+", start: t[index].start,
    bodyStart: at + 1, bodyEnd: end, end: t[end].end, model };
}

export function declarationTypes(model, begin = 0, end = model.tokens.length, known = new Set()) {
  const result = new Map(), { tokens: t, pairs } = model;
  function add(name, type) {
    if (result.has(name) && result.get(name) !== type) result.set(name, "unknown");
    else result.set(name, type);
  }
  for (let i = begin; i < end - 1; i++) {
    const type = t[i].value;
    if (!scalarType(type) && !known.has(type) && !/^(?:NS|UI|BG)[A-Z]\w*$/.test(type)) continue;
    let n = i + 1;
    if (t[n]?.value === "<") { while (n < end && t[n].value !== ">") n++; n++; }
    while (["*", "const", "__strong", "__weak", "_Nullable", "_Nonnull"].includes(t[n]?.value)) n++;
    if (t[n]?.value === "(" && t[n + 1]?.value === "^" && isIdentifier(t[n + 2]?.value)) {
      add(t[n + 2].value, "block"); i = pairs.get(n) ?? n; continue;
    }
    if (isIdentifier(t[n]?.value) && ["=", ";", ",", ")"].includes(t[n + 1]?.value)) add(t[n].value, type);
  }
  return result;
}

export function objcProject(sources) {
  const methods = [], classes = new Set(), parents = new Map(), macros = new Map(), files = [], fields = new Map(), globals = new Map();
  let incomplete = false;
  for (const source of sources) for (const m of maskedSource(source.text).matchAll(/@(?:interface|implementation)\s+(\w+)/g)) classes.add(m[1]);
  for (const source of sources) {
    const clean = maskedSource(withoutDirectives(source.text));
    for (const m of clean.matchAll(/@(?:interface|implementation)\s+(\w+)(?:\s*:\s*(\w+))?/g)) {
      classes.add(m[1]); if (m[2]) { const own = parents.get(m[1]) || new Set(); own.add(m[2]); parents.set(m[1], own); }
    }
    // Never use an executable macro expansion as a data primitive. Store only
    // its token classification, never literal source text in emitted metadata.
    for (const m of source.text.matchAll(/^\s*#\s*define\s+(\w+)([^\n]*)$/gm)) {
      const rhs = objcTokens(m[2]), value = rhs?.tokens || [];
      const simple = value.length === 1 && (value[0].literal || /^\d/.test(value[0].value));
      const kind = simple ? (value[0].value === "objc-string" ? "NSString" : value[0].value === "c-string" ? "c-string" : "scalar") : "unknown";
      macros.set(m[1], macros.has(m[1]) && macros.get(m[1]) !== kind ? "unknown" : kind);
    }
    const model = objcTokens(source.text); if (!model) { incomplete = true; continue; }
    const file = { ...source, model, methods: [] }; files.push(file);
    let owner;
    for (let i = 0; i < model.tokens.length; i++) {
      const t = model.tokens;
      if (t[i].value === "@" && t[i + 1]?.value === "implementation") { owner = t[i + 2]?.value; i += 2; continue; }
      if (t[i].value === "@" && t[i + 1]?.value === "end") { owner = undefined; continue; }
      if (!owner) continue;
      const method = signature(model, i, owner);
      if (method) { Object.assign(method, { path: source.path, sha256: source.sha256 }); methods.push(method); file.methods.push(method); i = method.bodyEnd; }
    }
    // Only declarations outside method bodies can establish fields/globals.
    // Partition by lexical owner: another class's field is never an own ivar.
    const outer = { ...model, tokens: model.tokens.map(token => file.methods.some(m => token.start >= m.start && token.start < m.end)
      ? { ...token, value: "" } : token) };
    let scopeOwner, begin = 0;
    const merge = (target, declarations) => { for (const [name, type] of declarations) {
      target.set(name, target.has(name) && target.get(name) !== type ? "unknown" : type);
    } };
    for (let i = 0; i < outer.tokens.length; i++) {
      const t = outer.tokens;
      if (t[i].value !== "@") continue;
      if (["interface", "implementation"].includes(t[i + 1]?.value)) {
        merge(globals, declarationTypes(outer, begin, i, classes));
        scopeOwner = t[i + 2]?.value; begin = i + 3;
      } else if (t[i + 1]?.value === "end" && scopeOwner) {
        const own = fields.get(scopeOwner) || new Map();
        merge(own, declarationTypes(outer, begin, i, classes)); fields.set(scopeOwner, own);
        scopeOwner = undefined; begin = i + 2;
      }
    }
    merge(globals, declarationTypes(outer, begin, outer.tokens.length, classes));

  }
  const byKey = new Map();
  for (const m of methods) {
    const key = `${m.owner}:${m.classMethod ? "+" : "-"}:${m.selector}`;
    const values = byKey.get(key) || []; values.push(m); byKey.set(key, values);
  }
  return { sources, files, methods, byKey, classes, parents, macros, fields, globals, incomplete };
}
