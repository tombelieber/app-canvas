import ts from "typescript";
import { createHash } from "node:crypto";

const script = new Set([".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"]);
const xml = new Set([".xml", ".storyboard", ".xib", ".plist"]);

// Preserve offsets while removing comments/literals; never include source
// text (which can contain credentials) in the generated worklist.
export function maskedSource(text) {
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"""[\s\S]*?"""|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/g,
    value => value.replace(/[^\n]/g, " "));
}

export function sourceObligations(content, extension, { path = "" } = {}) {
  const result = [], positions = [];
  for (let i = 0; i < content.length; i++) if (content[i] === "\n") positions.push(i);
  function line(index) {
    let low = 0, high = positions.length;
    while (low < high) { const mid = (low + high) >>> 1; if (positions[mid] < index) low = mid + 1; else high = mid; }
    return low + 1;
  }
  function add(kind, index, details = {}, end = index) {
    result.push({ kind, start: line(index), end: line(end), details: { offset: index, ...details } });
  }
  function branch(index) { for (const outcome of ["true", "false"]) add("branch", index, { outcome }); }
  if (script.has(extension)) {
    const source = ts.createSourceFile(`source${extension}`, content, ts.ScriptTarget.Latest, true,
      [".tsx", ".jsx"].includes(extension) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function walk(node) {
      const start = node.getStart(source);
      if (ts.isIfStatement(node) || ts.isConditionalExpression(node) ||
        ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) branch(start);
      if (ts.isCaseClause(node) || ts.isDefaultClause(node) || ts.isCatchClause(node)) add("branch", start, { outcome: "case" });
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) add("element", start);
      ts.forEachChild(node, walk);
    }
    walk(source);
    for (const diagnostic of source.parseDiagnostics) add("unresolved", diagnostic.start || 0);
  } else if (xml.has(extension)) {
    const clean = content.replace(/<!--[\s\S]*?-->/g, value => value.replace(/[^\n]/g, " "));
    const rootTag = clean.match(/<([A-Za-z_][\w.:-]*)\b/)?.[1];
    const lintConfiguration = rootTag === 'lint' && /(^|\/)lint\.xml$/.test(path) && !/(^|\/)res\//.test(path)
      && [...clean.matchAll(/<([\w.:-]+)\b[^>]*>/g)].every(match => ['lint', 'issue', 'ignore'].includes(match[1]));
    // IDE metadata uses XML too. Keep every tag in the review queue, while
    // allowing a specific non-UI explanation for recognized configuration.
    // Scene/destination declarations retain the rendering guard even here.
    const configuration = lintConfiguration || /(^|\/)\.idea\//.test(path) && rootTag === 'project'
      || /\.xcworkspace\/(?:xcshareddata|xcuserdata\/[^/]+)\/IDEWorkspaceChecks\.plist$/.test(path) && rootTag === 'plist'
      || extension === '.plist' && rootTag === 'plist' && !/>\s*(?:UI[A-Z]\w*|NS(?:View|Window)\w*|NS\w*UsageDescription|NSMainNibFile|NSMainStoryboardFile|CFBundleDisplayName)\s*</.test(clean)
      || extension === '.xml' && ['data-extraction-rules', 'full-backup-content', 'network-security-config'].includes(rootTag);
    for (const match of clean.matchAll(/<([\w.:-]+)\b[^>]*>/g)) {
      const tag = match[1];
      if (tag === "scene") add("scene", match.index);
      else if (["activity", "activity-alias", "fragment", "dialog", "segue", "viewController", "navigationController", "tableViewController", "collectionViewController"].includes(tag)) add("destination", match.index);
      else add("element", match.index, configuration ? { nonRenderingConfiguration: true } : {});
    }
  } else if (extension === ".json") {
    try {
      const value = JSON.parse(content);
      function walk(node, pointer = "") {
        if (Array.isArray(node)) node.forEach((child, index) => { add("record", 0, { pointerHash: createHash("sha256").update(`${pointer}/${index}`).digest("hex") }); walk(child, `${pointer}/${index}`); });
        else if (node && typeof node === "object") for (const [key, child] of Object.entries(node)) walk(child, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
      }
      walk(value);
    } catch { add("unresolved", 0); }
  } else {
    const clean = maskedSource(content);
    for (const match of clean.matchAll(/\b(if|case|default|catch|when)\b|\?(?![?.])/g)) {
      if (match[1] === "if") branch(match.index);
      else if (match[1] === undefined) add("candidate", match.index);
      else add("branch", match.index, { outcome: match[1] });
    }
    // UI calls outside a conditional still need a concrete state, especially
    // native error callbacks and programmatic presentations.
    for (const match of clean.matchAll(/\b(setText|setVisibility|setContentView|show|presentViewController|alertControllerWithTitle|performSegueWithIdentifier|startActivity|Text|AlertDialog)\b/g)) {
      const start = clean.lastIndexOf('\n', match.index) + 1, end = clean.indexOf('\n', match.index);
      const declaration = clean.slice(start, end < 0 ? clean.length : end).trim();
      const javaImport = extension === '.java' && /^import\s+(?:static\s+)?(?:[A-Za-z_$][\w$]*\.)*(?:[A-Za-z_$][\w$]*|\*)\s*;$/.test(declaration);
      add("presentation", match.index, javaImport ? { nonRenderingOutcome: { kind: 'java-import-declaration', reason: 'Java import binds a type or static name at compile time; it constructs and presents no UI. The imported implementation, owning UI source and actual calls remain separate review obligations.' } } : {});
    }
  }
  return result;
}
