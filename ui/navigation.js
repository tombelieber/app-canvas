// Fit against the actual canvas DOM area, including a docked inspector. Use
// setViewport rather than a queued fitView dependent on node measurements.
export function cameraFor(bounds, area, { padding = 48, maxZoom = 4, minZoom = .015 } = {}) {
  const zoom = Math.max(minZoom, Math.min(maxZoom, (area.width - padding * 2) / bounds.width, (area.height - padding * 2) / bounds.height));
  return { x: area.width / 2 - (bounds.x + bounds.width / 2) * zoom, y: area.height / 2 - (bounds.y + bounds.height / 2) * zoom, zoom };
}
export function screenBounds(node) {
  const scale = 390 / node.data.viewport.width;
  return { x: node.position.x, y: node.position.y - 42, width: 390, height: Math.min(node.data.height, 844 * scale) + 60 };
}
export function overviewBounds(nodes) {
  const left = Math.min(...nodes.map((n) => n.position.x)), top = Math.min(...nodes.map((n) => n.position.y - 45));
  return { x: left, y: top, width: Math.max(...nodes.map((n) => n.position.x + Number(n.style.width))) - left, height: Math.max(...nodes.map((n) => n.position.y + Number(n.style.height))) - top };
}
