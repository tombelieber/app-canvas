import { finite, identity, text, validateDocument, limits } from "./schema.mjs";
import { editableProperties, validateStyle, assetId, transformCss } from "./styles.mjs";
export function findLayer(root, id, parent = null) {
  if (root.id === id) return { node: root, parent };
  for (const child of root.children || []) { const found = findLayer(child, id, root); if (found) return found; }
  return null;
}
function duplicateNode(node, prefix) {
  let index = 0;
  const copy = structuredClone(node);
  const visit = current => { current.baseId ||= current.id; current.id = index++ ? `${prefix}-${index}` : prefix; for (const child of current.children || []) visit(child); };
  visit(copy); isolateSvgIds(copy, prefix); return copy;
}
function isolateSvgIds(root, prefix) {
  const ids = new Map(); let index = 0;
  const collect = node => { if (node.attrs?.id) { const previous = node.attrs.id; node.attrs.id = `${prefix}-svg-${index++}`; ids.set(previous, node.attrs.id); } node.children?.forEach(collect); };
  collect(root);
  const reference = value => value.startsWith("#") && ids.has(value.slice(1)) ? `#${ids.get(value.slice(1))}` : value;
  const rewrite = node => {
    if (node.attrs?.href) node.attrs.href = reference(node.attrs.href);
    for (const [key, value] of Object.entries(node.attrs || {})) if (["fill", "stroke", "mask", "clip-path"].includes(key) && value.includes("url")) node.attrs[key] = transformCss(value, reference);
    for (const [key, value] of Object.entries(node.style || {})) if (value.includes("url")) node.style[key] = transformCss(value, reference);
    node.children?.forEach(rewrite);
  };
  rewrite(root);
}
export function applyEdits(project, bases, history = project.history, cursor = project.cursor, reservedBytes = 0, { metadataOnly = false } = {}) {
  if (!Array.isArray(history) || history.length > 2000 || !Number.isInteger(cursor) || cursor < 0 || cursor > history.length) throw Error("Invalid edit history");
  const screens = structuredClone(project.screens), documents = {}, original = {};
  const touched = new Set(history.map(op => op?.screenId));
  if (!Number.isSafeInteger(reservedBytes) || reservedBytes < 0) throw Error("Invalid reserved capture size");
  let materializedBytes = reservedBytes;
  for (const screen of screens) { if (!bases[screen.documentId]) throw Error("Missing document"); documents[screen.id] = metadataOnly && !touched.has(screen.id) ? bases[screen.documentId] : structuredClone(bases[screen.documentId]); original[screen.id] = bases[screen.documentId]; }
  for (const doc of Object.values(documents)) materializedBytes += JSON.stringify(doc).length;
  if (materializedBytes > limits.project) throw Error("Materialized project exceeds size limit");
  // Validate the redo tail too: invalid operations must never become durable.
  let requested;
  const snapshot = () => ({ screens: structuredClone(screens), ...(metadataOnly ? {} : { documents: structuredClone(documents) }) });
  if (!cursor && history.length) requested = snapshot();
  for (let i = 0; i < history.length; i++) {
    const op = history[i]; if (!op || typeof op !== "object") throw Error("Invalid edit");
    identity(op.screenId); const screen = screens.find(s => s.id === op.screenId), doc = documents[op.screenId];
    if (!screen || !doc) throw Error("Edit references missing screen");
    if (op.type === "duplicateScreen") {
      identity(op.newId); text(op.value, 200); if (documents[op.newId] || screens.length >= limits.states) throw Error("Duplicate screen identity or limit");
      materializedBytes += JSON.stringify(doc).length; if (materializedBytes > limits.project) throw Error("Materialized project exceeds size limit");
      screens.push({ ...structuredClone(screen), id: op.newId, title: op.value }); documents[op.newId] = structuredClone(doc); original[op.newId] = original[op.screenId];
    } else if (op.type === "renameScreen") screen.title = text(op.value, 200);
    else if (op.type === "resetScreen") documents[op.screenId] = structuredClone(original[op.screenId]);
    else {
      identity(op.layerId); const found = findLayer(doc.root, op.layerId); if (!found) throw Error("Edit references missing layer");
      const { node, parent } = found;
      if (node.uneditable) throw Error("This captured region is read-only");
      if (op.type === "setText") { if (node.text === undefined) throw Error("Select a text layer"); node.text = text(op.value, 100000); }
      else if (op.type === "setStyle") { if (!editableProperties.has(op.property)) throw Error("Unsupported editable style"); (node.style ||= {})[op.property] = validateStyle(op.property, op.value); }
      else if (op.type === "move") node.offset = { x: finite(op.x), y: finite(op.y) };
      else if (op.type === "resize") {
        if (op.width === undefined && op.height === undefined) throw Error("Missing resize geometry");
        Object.assign(node.style ||= {}, { ...(op.width !== undefined ? { width: `${finite(op.width, 1)}px` } : {}), ...(op.height !== undefined ? { height: `${finite(op.height, 1)}px` } : {}), "flex-shrink": "0", "box-sizing": "border-box" });
      }
      else if (op.type === "rename") node.name = text(op.value, 200);
      else if (op.type === "setHidden") { if (typeof op.value !== "boolean") throw Error("Invalid visibility"); node.hidden = op.value; }
      else if (op.type === "setImage") { if (node.tag !== "img" || !assetId(op.value) || !project.assets.some(a => a.id === op.value && a.mime.startsWith("image/"))) throw Error("Select a local image asset"); node.attrs.src = `asset:${op.value}`; }
      else if (op.type === "delete") { if (!parent) throw Error("Cannot delete document root"); parent.children.splice(parent.children.indexOf(node), 1); }
      else if (op.type === "duplicate") { if (!parent) throw Error("Cannot duplicate document root"); identity(op.newId); if (findLayer(doc.root, op.newId)) throw Error("Duplicate layer identity"); parent.children.splice(parent.children.indexOf(node) + 1, 0, duplicateNode(node, op.newId)); }
      else if (op.type === "reorder") {
        if (!parent || !["forward", "backward"].includes(op.direction)) throw Error("Invalid layer order");
        const index = parent.children.indexOf(node), next = Math.max(0, Math.min(parent.children.length - 1, index + (op.direction === "forward" ? 1 : -1)));
        parent.children.splice(index, 1); parent.children.splice(next, 0, node);
      } else if (op.type === "resetLayer") {
        const base = findLayer(original[op.screenId].root, node.baseId || node.id)?.node; if (!base) throw Error("Original layer unavailable");
        const restored = structuredClone(base);
        if (node.baseId) { let counter = 0; const remap = new Map(); const remember = n => { remap.set(n.baseId || n.id, n.id); n.children?.forEach(remember); }; remember(node); const restore = n => { n.baseId ||= n.id; n.id = remap.get(n.id) || `${op.layerId}-reset-${counter++}`; n.children?.forEach(restore); }; restore(restored); }
        if (node.baseId) isolateSvgIds(restored, op.layerId);
        if (parent) parent.children.splice(parent.children.indexOf(node), 1, restored); else doc.root = restored;
      } else throw Error("Unsupported edit operation");
      if (["duplicate", "resetLayer"].includes(op.type)) { validateDocument(doc); if (JSON.stringify(doc).length > limits.state) throw Error("Edited document exceeds size limit"); }
    }
    if (i + 1 === cursor && cursor < history.length) requested = snapshot();
  }
  return requested || { screens, ...(metadataOnly ? {} : { documents }) };
}
