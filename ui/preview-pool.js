// Keep edited app instances alive. Unvisited/offscreen previews are disposable;
// never serialize/replay arbitrary app input events to pretend to restore state.
export function previewPool({ nodes, viewport, area, selected, active, retained, limit, playing }) {
  const ids = new Set(retained);
  if (playing) return ids;
  if (!playing && active) ids.add(active);
  if (!playing && selected && ids.size < limit) ids.add(selected);
  const candidates = nodes.filter(n => n.type === "screen" && n.data.visible && !n.data.compact).map(n => {
    const x = n.position.x * viewport.zoom + viewport.x, y = n.position.y * viewport.zoom + viewport.y;
    const width = 390 * viewport.zoom, height = n.data.height * viewport.zoom;
    return { id: n.id, visible: width >= 80 && x + width > 0 && y + height > 0 && x < area.width && y < area.height, distance: Math.hypot(x - area.width / 2, y - area.height / 2) };
  }).filter(n => n.visible).sort((a, b) => a.distance - b.distance);
  for (const n of candidates) if (ids.size < limit - (playing ? 1 : 0)) ids.add(n.id);
  return ids;
}
