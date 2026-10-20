import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import ts from 'typescript';
import { discoverSources } from './discovery.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const scripts = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

function scriptSurfaces(text, extension) {
  const source = ts.createSourceFile('app' + extension, text, ts.ScriptTarget.Latest, true,
    ['.jsx', '.tsx'].includes(extension) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const result = [];
  const jsx = node => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
  const boolean = node => node?.kind === ts.SyntaxKind.TrueKeyword ? true : node?.kind === ts.SyntaxKind.FalseKeyword ? false : undefined;
  function containsUi(node) {
    if (!node) return false;
    if (jsx(node)) return true;
    let found = false;
    ts.forEachChild(node, child => { if (containsUi(child)) found = true; });
    return found;
  }
  function add(kind, node, extra = {}) {
    const offset = node.getStart(source);
    result.push({ kind, offset, line: source.getLineAndCharacterOfPosition(offset).line + 1, ...extra });
  }
  function walk(node, insideJsx = false) {
    if (jsx(node) && !insideJsx) add('render', node);
    const branch = ts.isIfStatement(node) && (containsUi(node.thenStatement) || containsUi(node.elseStatement))
      || ts.isConditionalExpression(node) && (containsUi(node.whenTrue) || containsUi(node.whenFalse) || insideJsx)
      || ts.isBinaryExpression(node) && insideJsx && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind);
    const known = ts.isIfStatement(node) ? boolean(node.expression) : ts.isConditionalExpression(node) ? boolean(node.condition) : undefined;
    if (branch) for (const outcome of known === undefined ? ['true', 'false'] : [String(known)]) add('render-condition', node, { outcome });
    if (known !== undefined) {
      const selected = ts.isIfStatement(node) ? known ? node.thenStatement : node.elseStatement : known ? node.whenTrue : node.whenFalse;
      if (selected) walk(selected, insideJsx);
      return;
    }
    ts.forEachChild(node, child => walk(child, insideJsx || jsx(node)));
  }
  walk(source);
  return result;
}

// Discovery is independent of the authored catalog. Syntax supplies inspection
// anchors, while the agent still owns semantic states, lifetimes and navigation.
// Internal predicates remain in the unchanged strict source-audit worklist.
export async function discoverUi(root, options = {}) {
  const source = await discoverSources(root, options), anchors = [];
  const byPath = new Map();
  for (const row of source.obligations) {
    if (!byPath.has(row.path)) byPath.set(row.path, []);
    byPath.get(row.path).push(row);
  }
  for (const file of source.files) {
    const extension = extname(file.path).toLowerCase(), rows = byPath.get(file.path) || [];
    function add(kind, offset, line, details = {}) {
      anchors.push({ id: hash([file.path, file.sha256, kind, offset, details]), path: file.path, kind, line, offset, ...details });
    }
    const owner = rows.find(row => row.kind === 'file' && row.nativeUi);
    if (owner) add('native-owner', 0, 1, { classes: owner.nativeUi.classes });
    for (const row of rows) {
      if (row.kind === 'unresolved') source.issues.push({ path: file.path, line: row.start, reason: 'Source syntax requires an inspection adapter' });
      if (owner && ['branch', 'candidate'].includes(row.kind) && !row.nativeUiRole)
        add('native-state-site', row.offset || 0, row.start, { outcome: row.outcome || 'inspect' });
      if (['scene', 'destination', 'presentation'].includes(row.kind) && row.nonRenderingOutcome?.kind !== 'java-import-declaration')
        add(row.kind, row.offset || 0, row.start);
      if (row.nativeUiRole) add('native-accessory', row.offset, row.start, { surface: row.nativeUiSurface, role: row.nativeUiRole });
    }
    if (scripts.has(extension)) {
      for (const item of scriptSurfaces(await readFile(resolve(root, file.path), 'utf8'), extension)) {
        const { kind, offset, line, ...details } = item;
        add(kind, offset, line, details);
      }
    } else if (extension === '.xml' && /(?:^|\/)res\/(?:layout[^/]*|menu|drawable[^/]*)\//.test(file.path)) {
      const text = (await readFile(resolve(root, file.path), 'utf8')).replace(/<!--[\s\S]*?-->/g, '');
      if (/^\s*(?:<\?xml[^>]*>\s*)?<(?!resources\b)/.test(text)) add('native-resource', 0, 1);
      if (/<selector\b/.test(text)) for (const row of rows.filter(row => row.kind === 'element' && row.offset !== undefined))
        add('resource-state', row.offset, row.start);
    } else if (['.html', '.htm', '.vue', '.svelte', '.dart', '.kt', '.swift'].includes(extension)) {
      const content = await readFile(resolve(root, file.path), 'utf8');
      if (['.html', '.htm', '.vue', '.svelte'].includes(extension) || /@Composable\b|\bWidget\s+build\s*\(|\bvar\s+body\s*:\s*some\s+View\b/.test(content)) add('template-or-declarative-ui', 0, 1);
    }
  }
  const unique = [...new Map(anchors.map(row => [row.id, row])).values()];
  return { version: 1, files: source.files, anchors: unique, excluded: source.excluded,
    exclusions: source.obligations.filter(row => row.kind === 'exclusion').map(row => ({ id: row.id, path: row.path })),
    issues: source.issues, auditObligations: source.obligations.length };
}

export function uiWorkStatus(inventory) {
  const states = inventory.states || [], reviews = new Set((inventory.fileReviews || []).map(row => row.path));
  const bindings = new Set((inventory.bindings || []).map(row => row.anchor));
  return {
    sourceFiles: inventory.files?.length || 0,
    sourceFilesToInspect: (inventory.files || []).filter(row => !reviews.has(row.path)).length,
    uiAnchorsToResolve: (inventory.anchors || []).filter(row => !bindings.has(row.id)).length,
    screens: new Set(states.map(row => row.pageId)).size,
    states: states.length,
    missingUi: states.filter(row => row.status !== 'covered' || !row.cases?.length || row.blocker).map(row => ({ id: row.id, pageId: row.pageId, reason: row.blocker || row.status || 'not rendered' })),
    sourceAuditObligations: inventory.auditObligations,
  };
}
