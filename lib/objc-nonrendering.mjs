import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { maskedSource } from "./source-obligations.mjs";
import { objcProject, scalarType, isIdentifier } from "./objc-source-model.mjs";
import { dataType, platformClasses, platformSelectors, platformConstants, primitiveFunctions, platformFunction, platformMessage } from "./objc-effect-models.mjs";
import { ObjcEffectReader, OpaqueObjcEffect } from "./objc-effect-reader.mjs";

const opaque = reason => { throw new OpaqueObjcEffect(reason); };
const val = type => ({ type });
const normalize = type => ["void", "sqlite3", "sqlite3_stmt", "dispatch_queue_t"].includes(type) ? type : scalarType(type) ? "scalar" : type;
const variants = value => value.variants || [value];
function joined(values) {
  const all = values.flatMap(variants).map(({ target, ...v }) => v);
  const unique = all.filter((v, i) => all.findIndex(other => other.type === v.type && other.block === v.block && other.sourceClass === v.sourceClass && other.classObject === v.classObject && other.binding === v.binding && other.pointee === v.pointee && other.self === v.self) === i);
  return unique.length === 1 ? unique[0] : { type: "union", variants: unique };
}
const safeData = value => variants(value).every(v => !v.classObject && dataType(v.type));
const contractType = value => safeData(value) ? (value.type === "union" ? "DataValue" : value.type) : !value.classObject && ["block", "address", "dispatch_queue_t", "NSMutableURLRequest", "BGProcessingTaskRequest"].includes(value.type) ? value.type : "unknown";

class EffectContext {
  constructor(analysis, method, env = new Map(), returns = [], policy) { Object.assign(this, { analysis, method, env, returns, policy }); }
  // Local declarations shadow, while writes to existing outer bindings are
  // joined. All control paths are inspected; no path feasibility is assumed.
  scope() { return new EffectContext(this.analysis, this.method, new Map(this.env), this.returns, this.policy); }
  capture() { return new EffectContext(this.analysis, this.method, new Map([...this.env].map(([n, b]) => [n, { ...b }])), [], this.policy); }
  isType(name) { return scalarType(name) || ["id", "Class"].includes(name) || this.analysis.project.classes.has(name) || platformClasses.has(name); }
  castType(tokens) {
    const names = tokens.map(t => t.value).filter(v => !["*", "const", "__strong", "__weak", "nullable", "nonnull", "_Nullable", "_Nonnull"].includes(v));
    return names.length === 1 && this.isType(names[0]) ? names[0] : undefined;
  }
  cast(type, value) {
    type = normalize(type);
    if (type === "id" || variants(value).every(v => v.type === type || v.type === "nil")) return value;
    if (type === "scalar" && variants(value).every(v => v.type === "scalar" || v.type === "nil")) return val("scalar");
    if (["NSArray", "NSDictionary", "NSString"].includes(type) && variants(value).every(v => ["DataValue", "DataArray", "DataDictionary", type, "nil"].includes(v.type))) return value;
    opaque("cast cannot establish data or source-object identity");
  }
  join(values) { return joined(values); }
  declare(name, type) { this.env.set(name, { type: normalize(type), value: val("uninitialized") }); }
  binding(name) {
    if (this.env.has(name)) return this.env.get(name);
    const project = this.analysis.project, types = [project.fields.get(this.method.owner)?.get(name), project.globals.get(name)].filter(Boolean);
    if (!types.length || new Set(types).size !== 1) return;
    const type = normalize(types[0]);
    // Object-valued global/ivar contents are not established by a declaration.
    const value = ["scalar", "sqlite3", "sqlite3_stmt"].includes(type) ? val(type) : val("unknown");
    const binding = { type, value, field: true }; this.env.set(name, binding); return binding;
  }
  lookup(name) {
    if (this.analysis.project.macros.get(name) === "unknown") opaque("unexpanded macro");
    const binding = this.binding(name);
    if (binding) return { ...binding.value, target: { name } };
    if (name === "self") return { type: "source", sourceClass: this.method.owner, classObject: this.method.classMethod, self: true };
    if (["nil", "NULL"].includes(name)) return val("nil");
    if (this.analysis.project.macros.has(name)) {
      const type = this.analysis.project.macros.get(name); if (type === "unknown") opaque("executable or ambiguous macro"); return val(type);
    }
    if (platformConstants.has(name)) return val("scalar");
    if (this.analysis.project.classes.has(name) || platformClasses.has(name)) return { type: name, sourceClass: this.analysis.project.classes.has(name) && !platformClasses.has(name) ? name : undefined, classObject: true };
    opaque("unresolved source identifier");
  }
  assign(target, value) {
    const binding = this.binding(target.name); if (!binding) opaque("unresolved write target");
    if (binding.field && !["scalar", "sqlite3", "sqlite3_stmt"].includes(binding.type)) opaque("object field write needs an ownership model");
    if (binding.field && variants(value).some(v => v.type !== binding.type && v.type !== "nil")) opaque("opaque field write");
    binding.value = binding.value.type === "uninitialized" ? value : joined([binding.value, value]);
  }
  address(value) {
    const binding = this.binding(value.target?.name);
    if (!binding || !["scalar", "c-string", "sqlite3", "sqlite3_stmt"].includes(binding.type)) opaque("opaque output pointer");
    return { type: "address", pointee: binding.type, binding };
  }
  return(value) { if (value.type !== "void" && !safeData(value)) opaque("opaque return value"); this.returns.push(value); }
  invoke(block, args) {
    const outputs = [];
    for (const candidate of variants(block)) {
      if (candidate.type === "nil") { outputs.push(val("nil")); continue; }
      if (!candidate.block) opaque("unbound or escaping callback");
      const b = candidate.block, context = b.context.capture();
      if (b.params.length !== args.length) opaque("callback signature mismatch");
      for (let i = 0; i < args.length; i++) context.env.set(b.params[i].name, { type: normalize(b.params[i].type), value: args[i] });
      this.analysis.work();
      new ObjcEffectReader(b.model, context).statements(b.begin, b.end);
      outputs.push(joined(context.returns.length ? context.returns : [val("void")]));
    }
    return joined(outputs);
  }
  function(name, args) {
    if (this.policy && name !== 'NSLog') opaque('unmodeled synchronous interval function');
    if (this.analysis.project.macros.has(name)) opaque("unexpanded function macro");
    const binding = this.binding(name);
    if (binding) return this.invoke(binding.value, args);
    if (this.analysis.shadowed.has(name)) opaque("source overrides a modeled function");
    const result = platformFunction(name, args.map(contractType), { shadowed: this.analysis.shadowed });
    if (!result) opaque(`unmodeled C call: ${name}`);
    for (const callback of result.callbacks || []) this.invoke(args[callback.index], callback.params.map(val));
    for (const [index, type] of result.outputs || []) {
      if (args[index]?.type === "nil") continue;
      const binding = args[index]?.binding; if (!binding || binding.type !== type) opaque("mismatched output pointer");
      binding.value = val(binding.type);
    }
    return val(result.type);
  }
  property(receiver, name, op, rhs) {
    if (op === "->") {
      if (!receiver.self || receiver.classObject) opaque("opaque ivar receiver");
      const own = this.analysis.project.fields.get(receiver.sourceClass)?.get(name);
      if (!own) opaque("unknown own ivar");
      if (rhs) { this.assign({ name }, rhs); return rhs; }
      return this.lookup(name);
    }
    return rhs ? this.message(receiver, `set${name[0].toUpperCase()}${name.slice(1)}:`, [rhs]) : this.message(receiver, name, []);
  }
  message(receiver, selector, args) {
    if (this.policy && !this.policy.has(selector)) opaque('unmodeled synchronous interval message');
    return joined(variants(receiver).map(candidate => {
      if (candidate.type === "nil") return val("nil");
      if (candidate.sourceClass) return this.analysis.call(candidate, selector, args);
      if (this.analysis.overrides.has(`${candidate.type}:${candidate.classObject ? "+" : "-"}:${selector}`)) opaque("source overrides a modeled selector");
      const result = platformMessage(candidate.type, selector, args.map(contractType), { shadowed: this.analysis.shadowed, classObject: candidate.classObject === true });
      if (!result) opaque(`unmodeled native message: ${candidate.type} ${selector}`);
      for (const callback of result.callbacks || []) this.invoke(args[callback.index], callback.params.map(val));
      return val(result.type);
    }));
  }
}

export function analyzeObjcNonRendering(sources) {
  const project = objcProject(sources), results = new Map(), failures = new Map(), stack = new Set();
  const shadowed = new Set([...project.macros.keys(), ...[...project.classes].filter(name => !platformClasses.has(name) || project.parents.has(name))]);
  const overrides = new Set(project.methods.filter(m => platformClasses.has(m.owner)).map(m => `${m.owner}:${m.classMethod ? "+" : "-"}:${m.selector}`));
  for (const file of project.files) for (let i = 0; i < file.model.tokens.length; i++) {
    const t = file.model.tokens, token = t[i];
    if (!primitiveFunctions.has(token.value) || file.methods.some(m => token.start >= m.start && token.start < m.end)) continue;
    const close = file.model.pairs.get(i + 1);
    if (t[i + 1]?.value === "(" && t[close + 1]?.value === "{" || ["*", "^"].includes(t[i - 1]?.value) && t[i + 1]?.value === ")" || ["=", ";"].includes(t[i + 1]?.value)) shadowed.add(token.value);
  }
  const platformOverride = project.methods.some(m => ["NSObject", "NSProxy"].includes(m.owner)) || project.methods.some(m => platformClasses.has(m.owner) && (platformSelectors.has(m.selector) || ["initialize", "load", "forwardInvocation:", "resolveInstanceMethod:", "resolveClassMethod:"].includes(m.selector)))
    || [...project.parents.keys()].some(name => platformClasses.has(name));
  const kvoRegistration = project.files.some(file => file.model.tokens.some((token, begin) => {
    if (token.value !== "[") return false;
    const names = new Set(), end = file.model.pairs.get(begin), t = file.model.tokens;
    for (let i = begin + 1; i < end; i++) {
      if (["[", "(", "{"].includes(t[i].value)) { i = file.model.pairs.get(i); continue; }
      if (isIdentifier(t[i].value) && t[i + 1]?.value === ":") names.add(t[i].value);
    }
    return names.has("addObserver") && names.has("forKeyPath");
  }));
  const runtimeMutation = platformOverride || kvoRegistration || sources.some(source => /\b(?:asm|__asm|dlsym|dlopen|_cdecl|method_exchangeImplementations|method_setImplementation|class_addMethod|class_replaceMethod|object_setClass|objc_setClass|objc_registerClassPair|sqlite3_create_\w*|sqlite3_(?:update|commit|rollback|trace|profile|authorizer|progress|wal|busy)_?\w*(?:hook|handler)|sqlite3_(?:vfs_register|auto_extension|load_extension|enable_load_extension|db_config|set_authorizer|config))\b|\b(?:NSURLProtocol|URLProtocol|NSURLCache|URLCache)\b|\bextension\s+(?:NS|UI|BG)\w+/.test(maskedSource(source.text)));
  let budget = 0, observed;
  const analysis = { project, shadowed, overrides,
    condition(path, offset) { observed.add(`${path}:${offset}`); },
    work() { if (++budget > 20000) opaque("project effect budget"); },
    evaluate(method, args) {
      this.work(); if (stack.has(method)) opaque("recursive source call");
      if (args.length !== method.params.length) opaque("source signature mismatch");
      stack.add(method);
      try {
        if (method.model.tokens.slice(method.bodyStart, method.bodyEnd).some(token => project.macros.get(token.value) === "unknown")) opaque("unexpanded body macro");
        const context = new EffectContext(this, method);
        for (let i = 0; i < args.length; i++) context.env.set(method.params[i].name, { type: normalize(method.params[i].type), value: args[i] });
        new ObjcEffectReader(method.model, context).statements(method.bodyStart, method.bodyEnd);
        if (normalize(method.returnType) === "void") return val("void");
        if (!context.returns.length) opaque("missing data return");
        return joined(context.returns);
      } finally { stack.delete(method); }
    },
    call(receiver, selector, args) {
      const owners = new Set([receiver.sourceClass]);
      function inherits(owner, target, seen = new Set()) {
        if (owner === target) return true; if (seen.has(owner)) return false;
        return [...(project.parents.get(owner) || [])].some(parent => inherits(parent, target, new Set(seen).add(owner)));
      }
      if (receiver.self) for (const owner of project.classes) if (inherits(owner, receiver.sourceClass)) owners.add(owner);
      for (const owner of project.classes) if ([...owners].some(target => inherits(target, owner)) && project.byKey.has(`${owner}:+:initialize`)) opaque("source class initialization needs its own effect contract");
      const methods = new Set();
      for (const owner of owners) {
        let level = [owner], found = [], seen = new Set();
        while (level.length && !found.length) {
          const next = [];
          for (const name of level) {
            if (seen.has(name)) opaque("cyclic source inheritance"); seen.add(name);
            found.push(...(project.byKey.get(`${name}:${receiver.classObject ? "+" : "-"}:${selector}`) || []));
            next.push(...(project.parents.get(name) || []));
          }
          level = next;
        }
        if (found.length !== 1) opaque("unresolved or ambiguous source dispatch");
        methods.add(found[0]);
      }
      return joined([...methods].map(method => this.evaluate(method, args)));
    },
  };
  const interval = (method, begin, end, bindings) => {
    if (project.incomplete || runtimeMutation) return false;
    if (method.model.tokens.slice(begin, end).some(token => project.macros.has(token.value))) return false;
    budget = 0; observed = new Set();
    const context = new EffectContext({ ...analysis, call() { opaque('source call in synchronous interval'); } }, method, new Map(), [],
      new Set(['stringByReplacingOccurrencesOfString:withString:', 'stringWithFormat:', 'objectForKey:']));
    for (const [name, type] of bindings) {
      if (!dataType(type)) return false;
      context.env.set(name, { type, value: val(type), field: true });
    }
    try {
      new ObjcEffectReader(method.model, context).statements(begin, end);
      return true;
    } catch (error) {
      if (!(error instanceof OpaqueObjcEffect)) throw error;
      return false;
    }
  };
  if (project.incomplete || runtimeMutation) return { project, results, failures, interval };
  for (const method of project.methods) {
    budget = 0;
    try {
      const args = method.params.map(p => val(normalize(p.type) === "scalar" ? "scalar" : "unknown"));
      observed = new Set(); analysis.evaluate(method, args); results.set(method, { observed });
    } catch (error) {
      if (!(error instanceof OpaqueObjcEffect)) throw error;
      failures.set(method, error.message);
    }
  }
  return { project, results, failures, interval };
}

export async function annotateObjcNonRendering(root, files, obligations) {
  const selected = files.filter(file => [".m", ".mm", ".h", ".c", ".cc", ".cpp", ".swift"].includes(extname(file.path).toLowerCase()));
  if (!selected.some(file => /\.mm?$/i.test(file.path))) return;
  const sources = await Promise.all(selected.map(async file => ({ ...file, text: await readFile(join(root, file.path), "utf8") })));
  const { results } = analyzeObjcNonRendering(sources);
  const dependencyDigest = createHash("sha256").update(JSON.stringify(selected.map(file => [file.path, file.sha256]).sort())).digest("hex");
  for (const [method, proof] of results) for (const obligation of obligations) {
    if (obligation.path !== method.path || obligation.kind !== "branch" || obligation.unreachable || obligation.nonRenderingOutcome) continue;
    if (!(obligation.offset > method.start && obligation.offset < method.end) || !proof.observed.has(`${method.path}:${obligation.offset}`)) continue;
    obligation.nonRenderingOutcome = { kind: "objc-nonrendering-method", methodOffset: method.start, dependencyDigest,
      reason: "Closed supported method and known continuations have only modeled data effects; caller UI, source regions and object ownership remain separately required." };
  }
}
