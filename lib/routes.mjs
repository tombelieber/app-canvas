import ts from "typescript";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const unwrap = (node) =>
  node &&
  (ts.isAsExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isSatisfiesExpression(node))
    ? unwrap(node.expression)
    : node;
function value(node, constants = {}) {
  node = unwrap(node);
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isPropertyAccessExpression(node))
    return constants[node.expression.getText()]?.[node.name.text];
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "slice"
  )
    return value(node.expression.expression, constants)?.slice(
      Number(node.arguments[0]?.getText() || 0),
    );
  return undefined;
}
export async function readStringMap(file, name) {
  const source = ts.createSourceFile(
    file,
    await readFile(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let result;
  function walk(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText() === name) {
      const init = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(init))
        result = Object.fromEntries(
          init.properties
            .filter(ts.isPropertyAssignment)
            .map((p) => [
              p.name.getText().replace(/['"]/g, ""),
              value(p.initializer),
            ]),
        );
    }
    ts.forEachChild(node, walk);
  }
  walk(source);
  if (!result) throw Error(`Missing route map ${name}`);
  return result;
}
export function parseRoutes(
  text,
  { file = "routes.tsx", constants = {} } = {},
) {
  const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
    rows = [];
  const pathJoin = (parent, path) =>
    path.startsWith("/") ? path : `${parent === "/" ? "" : parent}/${path}`;
  function tags(element) {
    const names = [];
    function walk(n) {
      if (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n))
        names.push(n.tagName.getText());
      ts.forEachChild(n, walk);
    }
    if (element) walk(element);
    return names;
  }
  function record(path, element) {
    const names = tags(element),
      component = names.at(-1) || "Unknown";
    if (!path) return;
    rows.push({
      path,
      component,
      kind:
        names.includes("Navigate") || component.endsWith("Redirect")
          ? "redirect"
          : "page",
      source: file,
    });
  }
  function object(node, parent = "") {
    if (!ts.isObjectLiteralExpression(node)) return;
    const props = Object.fromEntries(
      node.properties
        .filter(ts.isPropertyAssignment)
        .map((p) => [p.name.getText().replace(/['"]/g, ""), p.initializer]),
    );
    const path = props.path ? value(props.path, constants) : "",
      full =
        props.index?.getText() === "true"
          ? parent
          : path === undefined
            ? undefined
            : path
              ? pathJoin(parent, path)
              : parent;
    if (props.path && path === undefined)
      throw Error(`Unresolved route path: ${props.path.getText()}`);
    if (props.children && ts.isArrayLiteralExpression(props.children))
      for (const child of props.children.elements)
        object(child, full || parent);
    else if (props.element) record(full || "/", props.element);
  }
  function jsx(node, parent = "") {
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    const attrs = Object.fromEntries(
      opening.attributes.properties
        .filter(ts.isJsxAttribute)
        .map((a) => [
          a.name.getText(),
          a.initializer && ts.isJsxExpression(a.initializer)
            ? a.initializer.expression
            : a.initializer,
        ]),
    );
    const path = value(attrs.path, constants),
      full =
        attrs.index !== undefined ||
        opening.attributes.properties.some((a) => a.name?.getText() === "index")
          ? parent
          : path
            ? pathJoin(parent, path)
            : parent;
    if (attrs.path && path === undefined)
      throw Error(`Unresolved route path: ${attrs.path.getText()}`);
    const children = ts.isJsxElement(node)
      ? node.children
          .filter((c) => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c))
          .filter(
            (c) =>
              (ts.isJsxElement(c) ? c.openingElement : c).tagName.getText() ===
              "Route",
          )
      : [];
    if (children.length) children.forEach((c) => jsx(c, full));
    else record(full || "/", attrs.element);
  }
  function walk(node) {
    if (
      (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
      (ts.isJsxElement(node) ? node.openingElement : node).tagName.getText() ===
        "Route"
    ) {
      jsx(node);
      return;
    }
    if (
      ts.isCallExpression(node) &&
      /router/i.test(node.expression.getText()) &&
      ts.isArrayLiteralExpression(node.arguments[0])
    ) {
      for (const child of node.arguments[0].elements) object(child);
      return;
    }
    ts.forEachChild(node, walk);
  }
  walk(source);
  return [...new Map(rows.map((row) => [row.path, row])).values()];
}
export async function inventoryRoutes(file, options = {}) {
  return parseRoutes(await readFile(file, "utf8"), {
    ...options,
    file: options.source || file,
  });
}
export async function checkRouteCoverage(project, root) {
  const reports = [];
  for (const input of project.routeCoverage || []) {
    const constants = {};
    for (const map of input.maps || [])
      constants[map.name] = await readStringMap(
        resolve(root, map.file),
        map.name,
      );
    const actual = await inventoryRoutes(resolve(root, input.file), {
      source: input.file,
      constants,
    });
    const expected = JSON.parse(
      await readFile(resolve(root, input.snapshot), "utf8"),
    );
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw Error(
        `Route inventory changed: ${input.file}. Review pages/redirects and update ${input.snapshot} and the catalog.`,
      );
    const missing = actual.filter(
      (r) =>
        r.kind === "page" &&
        !project.catalog.some((s) => (s.pattern || s.path) === r.path),
    );
    if (missing.length)
      throw Error(
        `Pages missing from canvas: ${missing.map((r) => r.path).join(", ")}`,
      );
    reports.push({
      file: input.file,
      pages: actual.filter((r) => r.kind === "page").length,
      redirects: actual.filter((r) => r.kind === "redirect").length,
    });
  }
  return reports;
}
