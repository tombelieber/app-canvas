import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, MarkerType, ViewportPortal, useReactFlow, useViewport } from "@xyflow/react";
import { ScreenNode, GroupNode, PreviewContext } from "../ScreenNode.jsx";
import { OverviewPlane } from "../OverviewPlane.jsx";
import { layoutScreens } from "../layout.js";
import { visiblePreviews } from "../preview-pool.js";
import { overviewContent } from "../../lib/import/render.mjs";
import { findLayer } from "../../lib/import/patches.mjs";
import { screenList, materialize, retainDocument } from "./draft.js";
import { LayerTree } from "./LayerTree.jsx";
import { EditorFrame } from "./EditorFrame.jsx";
import { ImportInspector } from "./Inspector.jsx";
import "./import.css";
const types = { screen: ScreenNode, section: GroupNode }, empty = new Set();

export function ImportCanvas({ project: initial }) {
  const [stored, setStored] = useState(null), [history, setHistory] = useState([]), [cursor, setCursor] = useState(0), [capture, setCapture] = useState(null);
  const [selected, setSelected] = useState(null), [layer, setLayer] = useState(null), [cache, setCache] = useState({});
  const [mode, setMode] = useState("browse"), [view, setView] = useState("overview"), [page, setPage] = useState("all"), [query, setQuery] = useState("");
  const [notice, setNotice] = useState(""), [saving, setSaving] = useState(false), [errors, setErrors] = useState({}), [revision, setRevision] = useState(0);
  const [measured, setMeasured] = useState({ screens: {} });
  const areaRef = useRef(null), [area, setArea] = useState({ width: 1000, height: 800 }), camera = useReactFlow(), viewport = useViewport();
  const busy = useRef(false), dirtyRef = useRef(false), loadedRevision = useRef(null);
  const dirty = !!stored && (cursor !== stored.cursor || JSON.stringify(history) !== JSON.stringify(stored.history)); dirtyRef.current = dirty;
  const request = useCallback(async (path, input) => {
    const response = await fetch(path, input === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json", "X-App-Canvas-Token": initial.sessionToken }, body: JSON.stringify(input) });
    const body = await response.json(); if (!response.ok) throw Error(body.error || "Import request failed"); return body;
  }, [initial.sessionToken]);
  const load = useCallback(async (force = false) => {
    const next = await request("/api/import/state"); setCapture(next.session); if (next.manifest) setMeasured(next.manifest);
    if ((dirtyRef.current || busy.current) && !force) return;
    setStored(next.project); setHistory(next.project.history); setCursor(next.project.cursor); setRevision(next.project.revision); loadedRevision.current = next.project.revision;
    setSelected(old => old && next.screens.some(s => s.id === old) ? old : next.screens[0]?.id || null);
  }, [request]);
  useEffect(() => {
    load().catch(e => setNotice(e.message));
    const events = new EventSource("/events");
    events.onmessage = e => { const event = JSON.parse(e.data); setCapture(event.session); setMeasured(event); if (loadedRevision.current !== event.revision && !busy.current) { if (dirtyRef.current) setNotice("Project changed. Your unsaved edits are retained; save may require reloading the latest project."); else load().catch(e => setNotice(e.message)); } };
    return () => events.close();
  }, [load]);
  const screens = useMemo(() => stored ? screenList(stored, history, cursor) : [], [stored, history, cursor]);
  const screen = screens.find(s => s.id === selected), routes = [...new Set(screens.map(s => s.pageId))];
  useEffect(() => { if (selected && !screens.some(s => s.id === selected)) setSelected(screens[0]?.id || null); }, [screens, selected]);
  useEffect(() => {
    if (!screen || cache[screen.documentId]) return;
    if (dirtyRef.current && Object.keys(cache).length >= 8) { setNotice("Save edits before opening another document; the 8-document cache is full"); return; }
    let cancelled = false;
    const baseScreen = stored.screens.find(s => s.documentId === screen.documentId);
    request(`/import/base/${baseScreen.id}`).then(next => { if (!cancelled) setCache(old => retainDocument(old, screen.documentId, next, dirtyRef.current)); }).catch(e => setNotice(e.message));
    return () => { cancelled = true; };
  }, [screen?.documentId, cache, request, stored]);
  const localDocuments = useMemo(() => {
    const result = {}; if (!stored) return result;
    for (const s of screens) if (cache[s.documentId]) result[s.id] = materialize(cache[s.documentId].document, stored, history, cursor, s.id);
    return result;
  }, [screens, cache, stored, history, cursor]);
  const document = localDocuments[selected], assets = screen && cache[screen.documentId]?.assets;
  const node = document && layer && findLayer(document.root, layer)?.node;
  const overrides = useMemo(() => Object.fromEntries(Object.entries(localDocuments).map(([id, doc]) => [id, overviewContent(doc, cache[doc.id]?.assets || {})])), [localDocuments, cache]);
  const catalog = screens.map(s => ({ ...s, group: s.pageId, feature: "Captured states", viewport: localDocuments[s.id]?.viewport || stored.viewport }));
  const filtered = catalog.filter(s => (page === "all" || page === s.pageId) && (!query || `${s.title} ${s.pageId}`.toLowerCase().includes(query.toLowerCase())));
  const groups = routes.map((route, i) => ({ id: route, title: route, color: ["#476c89", "#4e826b", "#8a5d9b"][i % 3] }));
  const manifest = { screens: Object.fromEntries(screens.map(s => [s.id, { width: 1440, height: localDocuments[s.id]?.height || measured.screens?.[s.id]?.height || 1000, domUrl: `/import/document/${s.id}`, sharedUrl: `/import/overview/${s.id}` }])) };
  const nodes = layoutScreens(filtered, manifest, groups, { mode: view === "machine" ? "machine" : "overview", flows: stored?.flows || [] }).map(n => n.type === "screen" && n.id === selected && mode !== "browse" ? { ...n, data: { ...n.data, height: 1000 * 390 / 1440, viewport: { width: 1440, height: 1000 } }, style: { width: 390, height: 1000 * 390 / 1440 + 48 } } : n);
  const previews = visiblePreviews(nodes, viewport, area), hidden = useMemo(() => mode !== "browse" && selected ? new Set([selected]) : empty, [mode, selected]);
  const selectedNode = nodes.find(n => n.id === selected), links = useMemo(() => stored?.flows.filter(f => f.from === selected) || [], [stored, selected]);
  const navigate = useCallback(id => { if (busy.current) return; setSelected(id); setLayer(null); setPage("all"); setQuery(""); }, []);
  const operation = useCallback(op => {
    if (!selected || busy.current) return;
    const full = { screenId: selected, layerId: layer, ...op }, next = [...history.slice(0, cursor), full];
    try {
      if (document && !["duplicateScreen", "renameScreen"].includes(full.type)) materialize(cache[screen.documentId].document, stored, next, next.length, selected);
      setHistory(next); setCursor(next.length); setNotice("Unsaved changes");
      if (full.type === "duplicateScreen") setSelected(full.newId);
      if (full.type === "duplicate") setLayer(full.newId);
    } catch (error) { setNotice(error.message); }
  }, [selected, layer, history, cursor, document, cache, screen, stored]);
  const save = useCallback(async () => {
    if (!stored) return; busy.current = true; setSaving(true);
    try { const result = await request("/api/import/save", { expectedRevision: stored.revision, history, cursor }); setStored(old => ({ ...old, revision: result.revision, history, cursor })); loadedRevision.current = result.revision; setRevision(result.revision); setNotice("Saved"); }
    catch (error) { setNotice(error.message); } finally { busy.current = false; setSaving(false); }
  }, [stored, history, cursor, request]);
  const upload = async file => {
    if (file.size > 8 * 1024 ** 2) return setNotice("Image exceeds 8 MiB limit");
    busy.current = true; setSaving(true);
    try {
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
      const result = await request("/api/import/asset", { expectedRevision: stored.revision, data });
      setStored(old => ({ ...old, revision: result.revision, assets: [...old.assets.filter(a => a.id !== result.assetId), { id: result.assetId, mime: result.asset.mime }] }));
      setCache(old => ({ ...old, [screen.documentId]: { ...old[screen.documentId], assets: { ...old[screen.documentId].assets, [result.assetId]: result.asset } } }));
      setHistory([...history.slice(0, cursor), { type: "setImage", screenId: selected, layerId: layer, value: result.assetId }]); setCursor(cursor + 1); loadedRevision.current = result.revision; setNotice("Unsaved changes");
    } catch (error) { setNotice(error.message); } finally { busy.current = false; setSaving(false); }
  };
  const fit = useCallback(() => camera.fitView({ padding: .12, duration: 200, maxZoom: 1 }), [camera]);
  useEffect(() => { if (camera.viewportInitialized && nodes.length) { const item = nodes.find(n => n.id === selected); if (item && mode !== "browse") camera.fitBounds({ x: item.position.x - 20, y: item.position.y - 50, width: 430, height: 1000 * 390 / 1440 + 100 }, { duration: 180, padding: .08 }); else fit(); } }, [selected, mode, view, page, query, screens.length, camera.viewportInitialized]);
  useEffect(() => { const observer = new ResizeObserver(entries => setArea({ width: entries[0].contentRect.width, height: entries[0].contentRect.height })); if (areaRef.current) observer.observe(areaRef.current); return () => observer.disconnect(); }, []);
  useEffect(() => {
    const key = e => {
      if (e.key === "Escape") setMode("browse");
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); setCursor(old => Math.max(0, Math.min(history.length, old + (e.shiftKey ? 1 : -1)))); setNotice("Unsaved changes"); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [save, history.length]);
  const previewContext = { bridge: {}, selected, active: null, resets: {}, revision, runId: "import", mounted: empty, previews, previewErrors: errors };
  const edges = (stored?.flows || []).filter(f => filtered.some(s => s.id === f.from) && filtered.some(s => s.id === f.to)).map(f => ({ id: f.id, source: f.from, target: f.to, label: f.label, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#588a91", strokeDasharray: f.kind === "reference" ? "8 5" : undefined } }));
  return <PreviewContext.Provider value={previewContext}><div className="review-workspace has-top has-navigation has-inspector import-workspace" data-mode={mode}>
    <header className="workspace-bar"><div className="workspace-dock"><div className="workspace-identity"><a className="workspace-brand" href="./">App Canvas · {stored?.title || initial.title}</a><span className="sync-status ready">{stored?.screens.length || 0} captured states · desktop · observed scope</span></div>
      <div className="mode-switch">{["browse", "edit", "prototype"].map(next => <button key={next} disabled={saving} aria-pressed={mode === next} onClick={() => setMode(next)}>{next[0].toUpperCase() + next.slice(1)}</button>)}</div>
      <button onClick={() => setCursor(Math.max(0, cursor - 1))} disabled={!cursor || saving}>Undo</button><button onClick={() => setCursor(Math.min(history.length, cursor + 1))} disabled={cursor === history.length || saving}>Redo</button><button className="present" disabled={saving || !dirty} onClick={save}>{saving ? "Saving…" : "Save"}</button>
    </div></header>
    <aside className="layers-panel import-navigation"><div className="import-capture"><strong>URL capture</strong>{capture ? <><p>{capture.phase} · {capture.message}</p><button onClick={() => request("/api/import/capture", {}).catch(e => setNotice(e.message))}>Capture State</button><button onClick={() => request("/api/import/more", {}).catch(e => setNotice(e.message))}>Capture more content</button></> : <p>Saved project · source browser disconnected</p>}</div>
      <label className="import-search">Search states<input aria-label="Search states" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label>Page<select aria-label="Page filter" value={page} onChange={e => setPage(e.target.value)}><option value="all">All pages</option>{routes.map(route => <option key={route} value={route}>{route}</option>)}</select></label>
      <div className="import-states">{filtered.map(s => <button key={s.id} className={selected === s.id ? "active" : ""} onClick={() => navigate(s.id)}>{s.title}<small>{s.quality}</small></button>)}</div>
      {mode === "edit" && <LayerTree key={selected} document={document} selected={layer} onSelect={setLayer} />}
    </aside>
    <main className="canvas-area"><div className="import-view-controls"><button aria-pressed={view === "overview"} onClick={() => setView("overview")}>Landscape</button><button aria-pressed={view === "machine"} onClick={() => setView("machine")}>State graph</button><button onClick={fit}>Fit</button><span role="status">{notice || (dirty ? "Unsaved changes" : "Saved")}</span>{notice.includes("conflict") || notice.includes("Project changed") ? <button onClick={() => { if (!dirty || confirm("Reload the saved project and discard unsaved edits?")) { setCache({}); load(true).then(() => setNotice("Saved")); } }}>Reload saved project</button> : null}</div>
      <div className="flow-stage" ref={areaRef}><ReactFlow nodes={nodes} edges={edges} nodeTypes={types} defaultViewport={{ x: 20, y: 20, zoom: .6 }} onNodeClick={(_, n) => { if (n.type === "screen") navigate(n.id); }} onEdgeClick={(_, edge) => navigate(edge.target)} minZoom={.02} maxZoom={5} nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null} panOnScroll zoomOnDoubleClick={false}>
        <Background gap={24} size={1} color="#c9cdd3" /><Controls showInteractive={false} showFitView={false} /><MiniMap pannable zoomable />
        <OverviewPlane nodes={nodes} viewport={viewport} area={area} previews={previews} mounted={hidden} revision={revision} onError={setErrors} overrides={overrides} />
        {mode !== "browse" && document && assets && selectedNode && <ViewportPortal><div className="import-editor-surface nodrag nopan nowheel" style={{ left: selectedNode.position.x, top: selectedNode.position.y + 4, width: 390, height: 1000 * 390 / 1440 }}><EditorFrame document={document} assets={assets} selected={layer} onSelect={setLayer} onOperation={operation} onBrowse={() => setMode("browse")} prototype={mode === "prototype"} links={links} onNavigate={navigate} /></div></ViewportPortal>}
      </ReactFlow>{!screens.length && <div className="import-empty"><h2>Capture a product into App Canvas</h2><p>{capture?.phase === "paused" ? "Complete sign-in in the capture browser, then press Capture State." : "Explore in the capture browser; captured screens appear here."}</p></div>}</div>
    </main>
    <aside className="details-panel"><ImportInspector node={mode === "edit" ? node : null} screen={screen} busy={saving} operation={operation} duplicateScreen={() => operation({ type: "duplicateScreen", newId: `copy-${crypto.randomUUID()}`, value: `${screen.title} · copy` })} upload={upload} links={links} navigate={navigate} /></aside>
  </div></PreviewContext.Provider>;
}
