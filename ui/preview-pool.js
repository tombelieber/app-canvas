// Keep edited app instances alive. Unvisited/offscreen previews are disposable;
// never serialize/replay arbitrary app input events to pretend to restore state.
import { OVERVIEW_LIMIT } from "./overview-loader.js";
// Weak identity cache: immutable layout nodes own their disposable shell/body
// projections. Camera movement does not rewrite the entire React Flow model.
const projections = new WeakMap();
const landscapes = new WeakMap();
export function renderedNodes(nodes, previews, mounted) {
  if (nodes.length <= OVERVIEW_LIMIT) return nodes;
  // Keep graph geometry, handles and sibling ordering for every source case.
  // Only card contents are culled; retained app ancestors remain mounted.
  const result = nodes.map(node => {
    if (node.type !== "screen") return node;
    const shellOnly = !mounted.has(node.id) && (!previews.has(node.id) || !!(node.data.nativePreview && !node.data.nativeDetail));
    let cached = projections.get(node);
    if (!cached) { cached = {}; projections.set(node, cached); }
    return cached[String(shellOnly)] ||= { ...node, data: { ...node.data, shellOnly } };
  });
  const previous = landscapes.get(nodes);
  if (previous && result.every((node, i) => node === previous[i])) return previous;
  landscapes.set(nodes, result);
  return result;
}
export function visiblePreviews(nodes, viewport, area) {
  const visible = nodes.filter(n => {
    if (n.type !== "screen" || !n.data.visible) return false;
    const x = n.position.x * viewport.zoom + viewport.x, y = n.position.y * viewport.zoom + viewport.y;
    return x + 390 * viewport.zoom > 0 && y + n.data.height * viewport.zoom > 0 && x < area.width && y < area.height;
  });
  // Keep ordinary landscapes complete at overview zoom. Large landscapes load
  // the nearest source documents; camera navigation can address every case.
  if (visible.length > OVERVIEW_LIMIT) visible.sort((a, b) => {
    const distance = n => Math.hypot((n.position.x + 195) * viewport.zoom + viewport.x - area.width / 2, (n.position.y + n.data.height / 2) * viewport.zoom + viewport.y - area.height / 2);
    return distance(a) - distance(b);
  });
  return new Set(visible.slice(0, OVERVIEW_LIMIT).map(n => n.id));
}
export function previewPool({ nodes, viewport, area, selected, active, retained, limit, playing }) {
  const ids = new Set(retained);
  if (playing) return ids;
  if (!playing && active) ids.add(active);
  if (!playing && selected && ids.size < limit) ids.add(selected);
  const candidates = nodes.filter(n => n.type === "screen" && n.data.visible && !n.data.domUrl && !n.data.nativePending && (!n.data.nativePreview || n.data.nativeDetail) && !n.data.compact).map(n => {
    const x = n.position.x * viewport.zoom + viewport.x, y = n.position.y * viewport.zoom + viewport.y;
    const width = 390 * viewport.zoom, height = n.data.height * viewport.zoom;
    return { id: n.id, visible: width >= 80 && x + width > 0 && y + height > 0 && x < area.width && y < area.height, distance: Math.hypot(x - area.width / 2, y - area.height / 2) };
  }).filter(n => n.visible).sort((a, b) => a.distance - b.distance);
  for (const n of candidates) if (ids.size < limit - (playing ? 1 : 0)) ids.add(n.id);
  return ids;
}
