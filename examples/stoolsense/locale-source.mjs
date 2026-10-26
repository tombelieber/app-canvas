import ts from "typescript";

export const hasHan = value => /\p{Script=Han}/u.test(value);
const literal = node => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node);
const localeMarkup = text => text.replace(/(<html\s+lang=["'])zh-[^"']+(["'])/g, "$1en$2");
const encodeTemplate = text => text.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");

export function translateMessage(text, dictionary) {
  if (!hasHan(text)) return text;
  if (!Object.hasOwn(dictionary, text) || typeof dictionary[text] !== "string" || !dictionary[text].trim() || hasHan(dictionary[text]))
    throw Error(`Missing reviewed English message: ${JSON.stringify(text)}`);
  return localeMarkup(dictionary[text]);
}

export function localizeJavaScript(code, dictionary, fileName = "frame.js", expectations = {}) {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (source.parseDiagnostics.length) throw Error(`Invalid frozen JavaScript: ${fileName}`);
  const changes = [];
  const visit = node => {
    if (literal(node) && (hasHan(node.text) || node.text === "zh-HK")) {
      const call = node.parent;
      const name = ts.isCallExpression(call) && ts.isIdentifier(call.expression) ? call.expression.text : "";
      const expected = name === "summary" && call.arguments[0] === node || ["expect", "click"].includes(name) && call.arguments[1] === node;
      const value = node.text === "zh-HK" ? "en-GB" : translateMessage(node.text, expected ? { ...dictionary, ...expectations } : dictionary);
      let replacement;
      if (ts.isStringLiteral(node)) replacement = JSON.stringify(value);
      else if (ts.isNoSubstitutionTemplateLiteral(node)) replacement = `\`${encodeTemplate(value)}\``;
      else if (ts.isTemplateHead(node)) replacement = `\`${encodeTemplate(value)}\${`;
      else if (ts.isTemplateMiddle(node)) replacement = `}${encodeTemplate(value)}\${`;
      else replacement = `}${encodeTemplate(value)}\``;
      changes.push({ start: node.getStart(source), end: node.end, replacement });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  for (const change of changes.sort((a, b) => b.start - a.start)) code = code.slice(0, change.start) + change.replacement + code.slice(change.end);
  const result = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (result.parseDiagnostics.length) throw Error(`Localized JavaScript is invalid: ${fileName}`);
  return code;
}

export function localizeObject(value, dictionary, expectations = {}) {
  if (typeof value === "string") return translateMessage(value, dictionary);
  if (Array.isArray(value)) return value.map(item => localizeObject(item, dictionary, expectations));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === "text" && ["expect", "click"].includes(value.type) ? translateMessage(item, { ...dictionary, ...expectations }) : localizeObject(item, dictionary, expectations)]));
  return value;
}

export function localizeHtml(html, dictionary) {
  return html.replace(/>([^<>]+)</g, (_, text) => `>${translateMessage(text, dictionary)}<`)
    .replace(/((?:aria-label|title|placeholder|alt)=")([^"]+)(")/g, (_, before, text, after) => before + translateMessage(text, dictionary) + after)
    .replace(/(<html\s+lang=")[^"]+"/, "$1en\"");
}

export function localizeCsv(csv, dictionary) {
  // These reviewed fixtures use unquoted source fields. Reject a changed input
  // grammar rather than silently corrupt a new fixture during localization.
  if (csv.includes('"')) throw Error("Review quoted CSV fixture localization");
  const quote = value => /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return csv.split("\n").map(line => line.split(",").map(value => quote(translateMessage(value, dictionary))).join(",")).join("\n");
}
