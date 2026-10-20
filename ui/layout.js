import dagre from "@dagrejs/dagre";
export function layoutScreens(screens, manifest, groups, options = {}) {
  if (options.mode === "machine") {
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir: "LR", nodesep: 65, ranksep: 180, marginx: 60, marginy: 90 });
    graph.setDefaultEdgeLabel(() => ({}));
    const nodes = screens.map(s => {
      const width = s.viewport?.width || 390, height = s.viewport?.height || 844;
      const h = height * 390 / width;
      const nodeWidth = 390, nodeHeight = h + 48;
      graph.setNode(s.id, { width: nodeWidth, height: nodeHeight + 52 });
      return { id: s.id, type: "screen", data: { screen: s, width: nodeWidth, compact: false, height: h, viewport: { width, height }, url: manifest.screens?.[s.id]?.url, domUrl: manifest.screens?.[s.id]?.domUrl, sharedUrl: manifest.screens?.[s.id]?.sharedUrl, error: manifest.screens?.[s.id]?.error }, style: { width: nodeWidth, height: nodeHeight }, initialWidth: nodeWidth, initialHeight: nodeHeight, draggable: false };
    });
    for (const f of options.flows || []) if (graph.hasNode(f.from) && graph.hasNode(f.to) && f.from !== f.to) graph.setEdge(f.from, f.to);
    dagre.layout(graph);
    return nodes.map(n => { const p = graph.node(n.id); return { ...n, position: { x: p.x - n.initialWidth / 2, y: p.y - (n.initialHeight + 52) / 2 } }; });
  }
  // Large captured catalogs need a board-shaped overview, not tall strips.
  // Keep page ownership and the graph layout; ordinary Web geometry is exact.
  const balanced = options.nativeOverview && screens.length > 128;
  const areaFor = s => (((manifest.screens?.[s.id]?.height || 1100) * 390) / (s.viewport?.width || 390) + 158) * 490;
  const totalArea = balanced ? screens.reduce((sum, s) => sum + areaFor(s), 0) : 0;
  const aspect = Math.max(.5, Math.min(2, (options.area?.width || 1000) / (options.area?.height || 800)));
  const targetHeight = balanced ? Math.sqrt(totalArea / aspect) : 0;
  const desiredColumns = balanced ? Math.ceil(Math.sqrt(totalArea * aspect) / 490) : 20;
  const boardColumns = balanced ? Math.max(20, desiredColumns + Math.min(groups.length, Math.ceil(desiredColumns * .1))) : 20;
  const nodes = [],
    blocks = [],
    skyline = Array(boardColumns).fill(0);
  for (const g of groups) {
    const members = screens.filter((s) => s.group === g.id);
    if (!members.length) continue;
    const columns =
        balanced ? Math.max(3, Math.min(boardColumns, Math.ceil(members.reduce((sum, s) => sum + areaFor(s), 0) / targetHeight / 490))) : g.id === "app"
          ? 5
          : Math.max(
              3,
              Math.min(
                8,
                Math.ceil(
                  members.reduce(
                    (sum, s) =>
                      sum +
                      ((manifest.screens?.[s.id]?.height || 1100) * 390) /
                        (s.viewport?.width || 390) +
                      160,
                    0,
                  ) / 3300,
                ),
              ),
            ),
      width = columns * 490;
    let slot = 0,
      blockY = Infinity;
    for (let n = 0; n <= boardColumns - columns; n++) {
      const y = Math.max(...skyline.slice(n, n + columns));
      if (y < blockY) {
        slot = n;
        blockY = y;
      }
    }
    const blockX = slot * 490,
      heights = Array(columns).fill(100);
    members.forEach((s) => {
      const col = heights.indexOf(Math.min(...heights));
      const m = manifest.screens?.[s.id] || {},
        h = ((m.height || 1100) * 390) / (s.viewport?.width || 390);
      nodes.push({
        id: s.id,
        type: "screen",
        position: { x: blockX + 40 + col * 490, y: blockY + heights[col] },
        data: {
          screen: s,
          compact: false,
          width: 390,
          height: h,
          url: m.url,
          domUrl: m.domUrl,
          sharedUrl: m.sharedUrl,
          viewport: { width: m.width || s.viewport?.width || 390, height: m.height || s.viewport?.height || 844 },
          error: m.error,
        },
        style: { width: 390, height: h + 48 },
        initialWidth: 390,
        initialHeight: h + 48,
        draggable: false,
      });
      heights[col] += h + 158;
    });
    const height = Math.max(...heights);
    blocks.push({
      id: `group-${g.id}`,
      type: "section",
      position: { x: blockX, y: blockY },
      data: { ...g, count: members.length },
      style: { width, height },
      initialWidth: width,
      initialHeight: height,
      zIndex: -1,
      selectable: false,
      draggable: false,
    });
    for (let n = slot; n < slot + columns; n++)
      skyline[n] = blockY + height + 180;
  }
  return [...blocks, ...nodes];
}
