import { applyEdits } from "../../lib/import/patches.mjs";
export function screenList(project, history, cursor) {
  const screens = project.screens.map(s => ({ ...s }));
  for (const op of history.slice(0, cursor)) {
    const screen = screens.find(s => s.id === op.screenId);
    if (op.type === "duplicateScreen" && screen) screens.push({ ...screen, id: op.newId, title: op.value });
    if (op.type === "renameScreen" && screen) screen.title = op.value;
  }
  return screens;
}
export function materialize(document, project, history, cursor, screenId) {
  // Follow one copy's ancestry backwards. Materializing a selected copy must
  // not clone every sibling document once again for each visible screen.
  let ancestor = screenId; const relevant = [];
  for (let index = cursor - 1; index >= 0; index--) {
    const op = history[index];
    if (op.type === "duplicateScreen" && op.newId === ancestor) ancestor = op.screenId;
    else if (op.screenId === ancestor && !["duplicateScreen", "renameScreen"].includes(op.type)) relevant.push(op);
  }
  const screen = project.screens.find(s => s.id === ancestor && s.documentId === document.id);
  if (!screen) throw Error("Missing document ancestry");
  const edits = relevant.reverse().map(op => ({ ...op, screenId: ancestor }));
  return applyEdits({ ...project, screens: [screen] }, { [document.id]: document }, edits, edits.length).documents[ancestor];
}
export function layerRows(node, depth = 0, collapsed = new Set(), rows = []) {
  rows.push({ node, depth });
  if (!collapsed.has(node.id)) node.children?.forEach(child => layerRows(child, depth + 1, collapsed, rows));
  return rows;
}
export const layerName = node => node.name || (node.text !== undefined ? node.text.trim().slice(0, 70) || "Whitespace" : node.attrs?.["aria-label"] || node.attrs?.alt || node.tag);
export function retainDocument(cache, id, entry, dirty, capacity = 8) {
  if (!Object.hasOwn(cache, id) && Object.keys(cache).length >= capacity && dirty) throw Error("Save edits before opening another document; the 8-document cache is full");
  const result = { ...cache }; delete result[id]; result[id] = entry;
  while (Object.keys(result).length > capacity) delete result[Object.keys(result)[0]];
  return result;
}
