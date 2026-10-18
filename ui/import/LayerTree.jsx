import React, { useMemo, useState } from "react";
import { layerName, layerRows } from "./draft.js";
export function LayerTree({ document, selected, onSelect }) {
  const [collapsed, setCollapsed] = useState(new Set()), [scroll, setScroll] = useState(0);
  const rows = useMemo(() => document ? layerRows(document.root, 0, collapsed) : [], [document, collapsed]);
  const virtual = rows.length > 200, start = virtual ? Math.max(0, Math.floor(scroll / 30) - 8) : 0, end = virtual ? Math.min(rows.length, start + 60) : rows.length;
  return <section className="import-layers"><div className="import-section-title">Layers <small>{rows.length}</small></div><div className="import-layer-scroll" onScroll={e => setScroll(e.currentTarget.scrollTop)}>
    <div style={{ height: virtual ? rows.length * 30 : undefined, position: "relative" }}>{rows.slice(start, end).map(({ node, depth }, index) => <div key={node.id} className={`import-layer ${selected === node.id ? "selected" : ""}`} style={{ paddingLeft: Math.min(depth, 8) * 12, ...(virtual ? { position: "absolute", top: (start + index) * 30, width: "100%" } : {}) }}>
      {node.children?.length ? <button className="layer-toggle" aria-label={`${collapsed.has(node.id) ? "Expand" : "Collapse"} ${node.id}`} onClick={() => setCollapsed(old => { const next = new Set(old); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next; })}>{collapsed.has(node.id) ? "›" : "⌄"}</button> : <span className="layer-toggle" />}
      <button className="layer-select" aria-label={layerName(node)} title={`${node.id} · ${layerName(node)}`} onClick={() => onSelect(node.id)}><small>{node.text !== undefined ? "T" : node.tag === "img" ? "▧" : "◇"}</small>{layerName(node)}{node.hidden && <small>hidden</small>}{node.uneditable && <small>image</small>}</button>
    </div>)}</div>
  </div></section>;
}
