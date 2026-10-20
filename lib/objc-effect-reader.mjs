import { isIdentifier } from "./objc-source-model.mjs";
import { dataType } from "./objc-effect-models.mjs";

export class OpaqueObjcEffect extends Error {}
const opaque = reason => { throw new OpaqueObjcEffect(reason); };
const value = type => ({ type });
const operators = new Set("+ - * / % == != <= >= < > && || | & ! ~ ? : << >>".split(" "));

// Parsing and effect policy are separate: the reader recognizes only this
// bounded Objective-C expression/statement subset and delegates every call.
export class ObjcEffectReader {
  constructor(model, context) { this.model = model; this.t = model.tokens; this.pairs = model.pairs; this.context = context; }
  split(begin, end, separator = ",") {
    const ranges = []; let start = begin;
    for (let i = begin; i < end; i++) {
      if (["(", "[", "{"].includes(this.t[i].value)) { const next = this.pairs.get(i); if (next === undefined || next >= end) opaque("unbalanced expression"); i = next; }
      else if (this.t[i].value === separator) { ranges.push([start, i]); start = i + 1; }
    }
    if (start < end) ranges.push([start, end]);
    return ranges;
  }
  expression(begin, end, depth = 0) {
    if (depth > 64) opaque("expression depth");
    if (begin >= end) return value("void");
    let at = begin, result; const operations = [], operands = [];
    while (at < end) {
      const token = this.t[at].value;
      if (operators.has(token)) {
        if (at === begin && ["*", "&"].includes(token)) break;
        operations.push(token); at++; continue;
      }
      const parsed = this.primary(at, end, depth + 1);
      if (parsed.next <= at) opaque("unsupported expression");
      result = parsed.value; operands.push(result); at = parsed.next;
      if (at < end && ["=", "+=", "-=", "*=", "/="].includes(this.t[at].value)) {
        if (!result.target) opaque("unknown assignment target");
        const next = this.expression(at + 1, end, depth + 1);
        this.context.assign(result.target, next); return next;
      }
      if (at < end && ["++", "--"].includes(this.t[at].value)) {
        if (!result.target || result.type !== "scalar") opaque("unknown increment");
        this.context.assign(result.target, value("scalar")); at++; result = value("scalar");
      }
      if (at < end && this.t[at].value === ",") { at++; continue; }
      if (at < end && !operators.has(this.t[at].value)) opaque("unsupported expression suffix");
    }
    if (at < end) {
      if (this.t[at].value !== "&") opaque("unsupported pointer expression");
      const pointer = this.primary(at, end, depth + 1);
      if (pointer.next !== end) opaque("unsupported pointer expression suffix");
      return pointer.value;
    }
    if (!operations.length) return result || value("void");
    if (operations.includes("?") || operations.includes(":")) return this.context.join(operands);
    if (operations.every(op => ["==", "!=", "<=", ">=", "<", ">", "&&", "||", "!"].includes(op))) return value("scalar");
    if (operands.some(v => v.type !== "scalar")) opaque("unsupported non-scalar arithmetic");
    return value("scalar");
  }
  primary(begin, end, depth) {
    if (depth > 64 || begin >= end) opaque("incomplete expression");
    let at = begin, token = this.t[at].value, result;
    if (token === "^") return this.block(begin, end);
    if (token === "@" && this.t[at + 1]?.value === "available") {
      const open = at + 2, close = this.pairs.get(open);
      if (this.t[open]?.value !== "(" || close === undefined || close >= end) opaque("unsupported availability guard");
      const body = this.t.slice(open + 1, close).map(t => t.value);
      if (body.length !== 4 || body[0] !== "iOS" || !/^\d+(?:\.\d+)?$/.test(body[1]) || body[2] !== "," || body[3] !== "*") opaque("unsupported availability guard");
      return { value: value("scalar"), next: close + 1 };
    }
    if (token === "@" && ["[", "{"].includes(this.t[at + 1]?.value)) {
      const open = at + 1, close = this.pairs.get(open); if (close === undefined || close >= end) opaque("invalid data literal");
      const dictionary = this.t[open].value === "{";
      for (const [a, b] of this.split(open + 1, close)) {
        const parts = dictionary ? this.split(a, b, ":") : [[a, b]];
        if (dictionary && parts.length !== 2) opaque("unsupported dictionary literal");
        if (parts.some(([x, y]) => !dataType(this.expression(x, y, depth + 1).type))) opaque("opaque data literal value");
      }
      result = value(dictionary ? "DataDictionary" : "DataArray"); at = close + 1;
    } else if (token === "@" && this.t[at + 1]?.value === "(") {
      const close = this.pairs.get(at + 1); if (close === undefined || close >= end) opaque("invalid boxed value");
      if (this.expression(at + 2, close, depth + 1).type !== "scalar") opaque("opaque boxed value");
      result = value("NSNumber"); at = close + 1;
    } else if (token === "@" && /^\d/.test(this.t[at + 1]?.value || "")) { result = value("NSNumber"); at += 2; }
    else if (token === "[") { const message = this.message(at, end, depth + 1); result = message.value; at = message.next; }
    else if (token === "(") {
      const close = this.pairs.get(at); if (close === undefined || close >= end) opaque("invalid parenthesis");
      const type = this.context.castType(this.t.slice(at + 1, close));
      if (type && close + 1 < end) { const inner = this.primary(close + 1, end, depth + 1); result = this.context.cast(type, inner.value); at = inner.next; }
      else { result = this.expression(at + 1, close, depth + 1); at = close + 1; }
    } else if (["objc-string", "c-string", "character"].includes(token) || /^\d|^\.\d/.test(token)) {
      result = value(token === "objc-string" ? "NSString" : token === "c-string" ? "c-string" : "scalar"); at++;
    } else if (token === "&") {
      const inner = this.primary(at + 1, end, depth + 1); if (!inner.value.target) opaque("unknown address target");
      result = this.context.address(inner.value); at = inner.next;
    } else if (isIdentifier(token)) {
      if (this.t[at + 1]?.value === "(") {
        const close = this.pairs.get(at + 1); if (close === undefined || close >= end) opaque("invalid function arguments");
        const args = this.split(at + 2, close).map(([a, b]) => this.expression(a, b, depth + 1));
        result = this.context.function(token, args); at = close + 1;
      } else { result = this.context.lookup(token); at++; }
    } else opaque("unsupported expression token");
    while (at < end) {
      const op = this.t[at].value;
      if ([".", "->"].includes(op) && isIdentifier(this.t[at + 1]?.value)) {
        const name = this.t[at + 1].value, write = this.t[at + 2]?.value === "=";
        if (write) { const rhs = this.expression(at + 3, end, depth + 1); this.context.property(result, name, op, rhs); return { value: rhs, next: end }; }
        result = this.context.property(result, name, op); at += 2;
      } else if (op === "[") {
        const close = this.pairs.get(at); if (close === undefined || close >= end) opaque("invalid subscript");
        const key = this.expression(at + 1, close, depth + 1);
        result = this.context.message(result, key.type === "scalar" ? "objectAtIndexedSubscript:" : "objectForKeyedSubscript:", [key]); at = close + 1;
      } else break;
    }
    return { value: result, next: at };
  }
  message(begin, end, depth) {
    const close = this.pairs.get(begin); if (close === undefined || close >= end) opaque("invalid message");
    const receiver = this.primary(begin + 1, close, depth + 1); let at = receiver.next, selector = "", args = [];
    if (!isIdentifier(this.t[at]?.value)) opaque("unsupported selector");
    if (this.t[at + 1]?.value !== ":") { selector = this.t[at++].value; if (at !== close) opaque("unsupported unary message"); }
    else while (at < close) {
      if (!isIdentifier(this.t[at]?.value) || this.t[at + 1]?.value !== ":") opaque("unsupported keyword message");
      selector += this.t[at].value + ":"; at += 2; const start = at;
      while (at < close) {
        if (["(", "[", "{"].includes(this.t[at].value)) { at = this.pairs.get(at) + 1; continue; }
        if (isIdentifier(this.t[at].value) && this.t[at + 1]?.value === ":") break;
        at++;
      }
      if (start === at) opaque("empty message argument");
      args.push(...this.split(start, at).map(([a, b]) => this.expression(a, b, depth + 1)));
    }
    return { value: this.context.message(receiver.value, selector, args), next: close + 1 };
  }
  block(begin, end) {
    let at = begin + 1, params = [];
    if (this.t[at]?.value === "(") {
      const close = this.pairs.get(at); if (close === undefined || close >= end) opaque("invalid block parameters");
      for (const [a, b] of this.split(at + 1, close)) {
        const names = this.t.slice(a, b).map(t => t.value).filter(isIdentifier);
        if (names.length === 1 && names[0] === "void") continue;
        if (names.length < 2) opaque("opaque block parameter");
        params.push({ type: names[0], name: names.at(-1) });
      }
      at = close + 1;
    }
    if (this.t[at]?.value !== "{") opaque("unsupported block literal");
    const close = this.pairs.get(at); if (close === undefined || close >= end) opaque("invalid block body");
    return { value: { type: "block", block: { params, begin: at + 1, end: close, model: this.model, context: this.context.capture() } }, next: close + 1 };
  }
  statementEnd(begin, end) {
    let at = begin;
    for (; at < end; at++) {
      if (["(", "[", "{"].includes(this.t[at].value)) { const next = this.pairs.get(at); if (next === undefined || next >= end) opaque("invalid statement"); at = next; }
      else if (this.t[at].value === ";") return at;
    }
    return at;
  }
  declaration(begin, end) {
    let at = begin;
    while (["static", "const", "unsigned", "signed", "__unused"].includes(this.t[at]?.value)) at++;
    if (!this.context.isType(this.t[at]?.value)) return;
    const type = this.t[at++].value;
    const pointer = this.t[at]?.value === "*";
    while (this.t[at]?.value === "*") at++;
    let name, declared = type === "char" && pointer ? "c-string" : type;
    if (this.t[at]?.value === "(" && this.t[at + 1]?.value === "^") {
      name = this.t[at + 2]?.value; at = this.pairs.get(at) + 1;
      if (this.t[at]?.value !== "(") return;
      at = this.pairs.get(at) + 1; declared = "block";
    } else name = this.t[at++]?.value;
    if (!isIdentifier(name) || !["=", ";"].includes(this.t[at]?.value)) return;
    const stop = this.statementEnd(at, end); if (stop >= end) opaque("unterminated declaration");
    this.context.declare(name, declared);
    if (this.t[at].value === "=") this.context.assign({ name }, this.expression(at + 1, stop));
    return stop + 1;
  }
  statements(begin, end, depth = 0) {
    if (depth > 64 || end - begin > 30000) opaque("method parsing budget");
    for (let at = begin; at < end;) {
      const token = this.t[at].value;
      if (token === "__block" || token === "goto" || token === "asm") opaque("unsupported state or control escape");
      if ([";", "else", "do", "break", "continue"].includes(token)) { at++; continue; }
      if (token === "{") {
        const close = this.pairs.get(at); if (close === undefined || close >= end) opaque("invalid statement scope");
        new ObjcEffectReader(this.model, this.context.scope()).statements(at + 1, close, depth + 1); at = close + 1; continue;
      }
      if (["if", "while", "switch"].includes(token)) {
        if (token === "if") this.context.analysis.condition(this.context.method.path, this.t[at].start);
        const open = at + 1, close = this.pairs.get(open); if (this.t[open]?.value !== "(" || close === undefined || close >= end) opaque("unsupported control header");
        this.expression(open + 1, close); at = close + 1; continue;
      }
      if (token === "for") opaque("unsupported loop declaration scope");
      if (["case", "default"].includes(token)) opaque("unsupported switch outcome");
      if (token === "return") {
        const stop = this.statementEnd(at + 1, end); this.context.return(this.expression(at + 1, stop)); at = stop + 1; continue;
      }
      const declaration = this.declaration(at, end);
      if (declaration !== undefined) { at = declaration; continue; }
      const stop = this.statementEnd(at, end); if (stop === at || stop >= end) opaque("unterminated expression statement");
      this.expression(at, stop); at = stop + 1;
    }
  }
}
