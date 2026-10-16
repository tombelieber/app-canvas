import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, MarkerType, ViewportPortal, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./canvas.css";
import { ScreenNode, GroupNode, PreviewContext } from "./ScreenNode.jsx";
import { layoutScreens } from "./layout.js";
import { cameraFor, screenBounds, overviewBounds } from "./navigation.js";
import { useBridge } from "./useBridge.js";
import { project, useManifest } from "./useManifest.js";
import { LiveFrame } from "./LiveFrame.jsx";
import { useJourney } from "./useJourney.js";
import { JourneyPanel } from "./JourneyPanel.jsx";
import { graphFlows, caseCoverage } from "../lib/coverage.mjs";
import { scopedScreens } from "../lib/pages.mjs";
import { previewPool, visiblePreviews } from "./preview-pool.js";
import { usePanelPreferences } from "./usePanelPreferences.js";
import { WorkspaceDock, ScopeToolbar, PageNavigator, Inspector } from "./WorkbenchChrome.jsx";
const nodeTypes = { screen: ScreenNode, section: GroupNode };
const { catalog, pages } = project;
const flows = graphFlows(project), coverage = caseCoverage(project);
const runId = crypto.randomUUID();

function Canvas() {
  const manifest = useManifest(), stage = useRef(null), camera = useReactFlow();
  const [page, setPage] = useState("all"), [query, setQuery] = useState("");
  const [selectedId, select] = useState(null), [active, setActive] = useState(null), [resets, setResets] = useState({});
  const [lines, setLines] = useState("related"), [zoom, setZoom] = useState(100), [request, setRequest] = useState(null);
  const [moving, setMoving] = useState(false), [viewport, setViewport] = useState({ x: 0, y: 0, zoom: .05 }), [area, setArea] = useState({ width: 800, height: 600 });
  const [journeyId, setJourneyId] = useState(""), [view, setView] = useState("overview"), [depth, setDepth] = useState("all");
  const [branches, setBranches] = useState(false), [autoStart, setAutoStart] = useState(false);
  const [retained, retain] = useState([]), [notice, setNotice] = useState(""), [menu, setMenu] = useState(false), [drawer, setDrawer] = useState(false);
  const preferences = usePanelPreferences(`app-canvas:panels:${location.pathname}:${project.title}`);
  const limit = navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches ? 4 : 8;
  const cameraRun = useRef(0), previousNodes = useRef(new Map());
  const definition = project.journeys.find(j => j.id === journeyId);
  const plan = useMemo(() => journeyId === "__all__" ? project.journeys : journeyId === "__flows__" ? project.journeys.filter(j => j.kind !== "case") : journeyId === "__cases__" ? project.journeys.filter(j => j.kind === "case") : definition ? [definition] : [], [journeyId, definition]);
  const journeyScreens = useMemo(() => definition && !branches ? [...new Set([definition.entry, ...definition.steps.map(s => s.screen)])] : null, [definition, branches]);
  const bridge = useBridge(() => { setActive(null); player.stop(); });
  const selected = catalog.find(s => s.id === selectedId);
  const visible = useMemo(() => scopedScreens(catalog, { page: journeyId ? "all" : page, query, depth: journeyId ? "all" : depth, selected: selectedId, journey: journeyScreens }), [page, query, depth, selectedId, journeyId, journeyScreens]);
  const navigate = useCallback((id, interact = false) => {
    const target = catalog.find(s => s.id === id); if (!target) return;
    if (interact && !retained.includes(id)) {
      if (retained.length >= limit - 1) { setNotice("已保留操作畫面；請喺「面板」釋放一個預覽，再解鎖新畫面。"); setMenu(true); interact = false; }
      else { retain(old => old.includes(id) ? old : [...old, id]); setNotice(""); }
    }
    select(id); setActive(interact ? id : null); setDrawer(false);
    if (target.pageId !== page) setPage(target.pageId);
    if (query && !`${target.id} ${target.title} ${target.feature}`.toLowerCase().includes(query.toLowerCase())) setQuery("");
    if (journeyScreens && !journeyScreens.includes(id)) setJourneyId("");
    setRequest({ id, nonce: performance.now() });
  }, [page, query, journeyScreens, retained, limit]);
  const player = useJourney({ definitions: plan, bridge, navigate });
  const browse = () => { setActive(null); player.stop(); };
  const goTo = (id, interact = false) => { player.stop(); navigate(id, interact); };
  const interact = (id = selectedId || catalog[0].id) => goTo(id, true);
  useEffect(() => { if (autoStart && plan.length) { player.start(); setAutoStart(false); } }, [autoStart, plan]);
  const chooseJourney = (id, autoplay = false) => { player.stop(); select(null); setActive(null); setPage("all"); setQuery(""); setJourneyId(id); setBranches(id.startsWith("__")); setAutoStart(autoplay); };
  const nodes = useMemo(() => {
    const groups = pages.map((p, i) => ({ ...p, color: project.groups[i % project.groups.length].color }));
    const grouped = visible.map(s => ({ ...s, group: s.pageId }));
    const layout = layoutScreens(grouped, manifest, groups, { mode: view === "machine" ? "machine" : "overview", flows, focusedId: selectedId });
    const ids = new Set(visible.map(s => s.id));
    const placed = layout.map(node => {
      if (node.type !== "screen") return node;
      const native = node.id === selectedId || node.id === active || node.id === player.state?.screen || journeyScreens?.includes(node.id);
      if (journeyScreens?.includes(node.id)) node = { ...node, position: { x: journeyScreens.indexOf(node.id) * 670, y: 90 } };
      if (native) {
        const height = node.data.screen.viewport?.height || 844, width = node.data.viewport.width;
        node = { ...node, initialWidth: 390, initialHeight: height * 390 / width + 48, data: { ...node.data, compact: false, width: 390, viewport: { width, height }, height: height * 390 / width }, style: { width: 390, height: height * 390 / width + 48 } };
      }
      node = { ...node, data: { ...node.data, visible: true } };
      previousNodes.current.set(node.id, node); return node;
    });
    for (const s of catalog) if (!ids.has(s.id)) {
      const prior = previousNodes.current.get(s.id) || layoutScreens([s], manifest, project.groups, { mode: "machine" })[0];
      placed.push({ ...prior, data: { ...prior.data, visible: false }, style: { ...prior.style, visibility: "hidden", pointerEvents: "none" } });
    }
    // Moving an iframe's ancestor in the DOM reloads its browsing context even
    // with a stable React key. Keep screen siblings in catalog order on filters.
    const byId = new Map(placed.map(n => [n.id, n]));
    return [...placed.filter(n => n.type !== "screen"), ...catalog.map(s => byId.get(s.id))];
  }, [visible, manifest, view, selectedId, active, player.state?.screen, journeyScreens, depth, area]);
  const previews = useMemo(() => visiblePreviews(nodes, viewport, area), [nodes, viewport, area]);
  const mounted = useMemo(() => {
    const ids = previewPool({ nodes, viewport, area, selected: selectedId, active, retained, limit, playing: !!player.state });
    // Legacy manifests and drawing surfaces that cannot be represented by
    // HTML/CSS retain their actual app, never a blank or fabricated thumbnail.
    for (const node of nodes) if (previews.has(node.id) && node.data.url && !node.data.domUrl) ids.add(node.id);
    return ids;
  }, [nodes, previews, viewport, area, selectedId, active, retained, limit, !!player.state]);
  const fit = useCallback(() => setRequest({ id: null, nonce: performance.now() }), []);
  useEffect(() => {
    const observer = new ResizeObserver(entries => { const r = entries[0].contentRect; setArea({ width: r.width, height: r.height }); setRequest({ id: selectedId, nonce: performance.now() }); });
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, [selectedId]);
  useLayoutEffect(() => {
    if (!request || !camera.viewportInitialized || !stage.current || !nodes.length) return;
    const node = request.id && nodes.find(n => n.id === request.id);
    if (request.id && !node) return;
    const visibleNodes = nodes.filter(n => n.type === "screen" && n.data.visible);
    if (!node && !visibleNodes.length) { setRequest(null); return; }
    const position = cameraFor(node ? screenBounds(node) : overviewBounds(visibleNodes), stage.current.getBoundingClientRect(), { padding: node ? 40 : 35, maxZoom: node ? 4 : 1 });
    const currentCamera = ++cameraRun.current; setMoving(true);
    camera.setViewport(position, { duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240 }).finally(() => { if (cameraRun.current === currentCamera) { setMoving(false); setViewport(camera.getViewport()); } });
    setRequest(null);
  }, [request, nodes, camera]);
  useEffect(() => { if (!selectedId) fit(); }, [manifest.status, fit]);
  useEffect(fit, [journeyId, view, depth, branches]);
  const selectPage = id => { browse(); setJourneyId(""); setPage(id); setQuery(""); select(null); setDrawer(false); fit(); };
  const search = value => { browse(); setJourneyId(""); setPage("all"); setQuery(value); select(null); fit(); };
  const changeView = next => { setView(next);  if (next === "machine") setBranches(true); };
  const release = id => {
    if (!confirm("釋放呢個虛構預覽？未保存嘅輸入同操作會清除。")) return;
    retain(old => old.filter(x => x !== id)); setResets(old => ({ ...old, [id]: (old[id] || 0) + 1 })); if (active === id) setActive(null); setNotice("");
  };
  useEffect(() => {
    const key = event => {
      if (event.key === "Escape") { setActive(null); player.stop(); setMenu(false); setDrawer(false); return; }
      if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.key === "1") { event.preventDefault(); fit(); }
      if (event.key === "2" && selectedId) { event.preventDefault(); navigate(selectedId, !!active); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [fit, navigate, selectedId, active]);
  const shown = new Set(visible.map(s => s.id));
  const journeyFlows = !branches && definition?.steps.map((step, i) => ({ from: i ? definition.steps[i - 1].screen : definition.entry, to: step.screen, label: step.title })).filter(edge => edge.from !== edge.to);
  const displayedFlows = journeyFlows || flows;
  const edges = lines === "none" ? [] : displayedFlows.filter(f => shown.has(f.from) && shown.has(f.to) && (journeyId || lines === "all" || f.from === selectedId || f.to === selectedId)).map((f, i) => ({
    id: `flow-${i}`, source: f.from, target: f.to, label: `${f.kind === "condition" ? "條件：" : f.kind === "reference" ? "參照：" : ""}${f.label || ""}`, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed, color: "#5d7ca5" },
    animated: player.state?.trace.at(-1)?.from === f.from && player.state?.trace.at(-1)?.to === f.to,
    style: { stroke: f.from === selectedId || f.to === selectedId ? "#287b83" : f.kind === "recovery" ? "#277d50" : "#7892ad", strokeDasharray: ["condition", "reference"].includes(f.kind) ? "10 6" : undefined, strokeWidth: f.from === selectedId || f.to === selectedId ? 3 : 2 }, labelStyle: { fontSize: 15, fill: "#33516d" }, labelBgPadding: [10, 6], labelBgBorderRadius: 5,
  }));
  const linked = displayedFlows.filter(f => f.from === selectedId || f.to === selectedId);
  const rendered = Object.values(manifest.screens || {}).filter(s => !s.error).length;
  const context = { bridge, selected: selectedId, active, resets, revision: manifest.revision, runId, mounted, previews };
  const journeyNode = player.state && nodes.find(node => node.id === player.state.screen), entryUrl = player.state && manifest.screens[player.state.definition.entry]?.url;
  const inspector = preferences.panels.right;
  const toggleRight = () => preferences.toggle("right");
  return <PreviewContext.Provider value={context}>
    <div className={`review-workspace ${inspector ? "has-inspector" : ""} ${preferences.panels.left ? "has-navigation" : ""} ${preferences.panels.top ? "has-top" : ""} ${drawer ? "drawer-open" : ""}`} data-view={view} data-mode={active ? "interact" : "browse"} data-preview-limit={limit} data-live-count={mounted.size + (player.state ? 1 : 0)} data-camera-ready={!moving && !request} data-live-ready={manifest.status === "ready" && [...mounted].every(id => bridge.states[id]?.ready && !bridge.states[id]?.error)}>
      <header className={preferences.panels.top ? "workspace-bar" : "workspace-floating"}>
        <WorkspaceDock preferences={preferences} menu={menu} setMenu={setMenu} drawer={drawer} setDrawer={setDrawer} active={active} browse={browse} interact={() => interact()} retained={retained} release={release} catalog={catalog} notice={notice} limit={limit} view={view} setView={changeView} fit={fit} rightOpen={inspector} toggleRight={toggleRight}
          brand={<div className="workspace-identity"><a className="workspace-brand" href="./">{project.title}</a><span className={`sync-status ${manifest.status === "ready" ? "ready" : ""}`}><i />{manifest.status === "ready" ? `${rendered} 個畫面 · ${project.static ? "示範版本" : "已同步"}` : manifest.status === "error" ? "載入失敗" : `正在載入 ${rendered} / ${catalog.length}`}</span></div>} />
      </header>
      {preferences.panels.left && <><button className="drawer-backdrop" aria-label="收起導航" onClick={() => setDrawer(false)} /><PageNavigator pages={pages} catalog={catalog} page={page} query={query} selectPage={selectPage} selectedId={selectedId} goTo={goTo} lines={lines} setLines={setLines} links={project.links} close={() => { setDrawer(false); preferences.toggle("left"); }}>
        <ScopeToolbar pages={pages} page={page} setPage={selectPage} query={query} search={search} depth={depth} setDepth={setDepth} />
      </PageNavigator></>}
      <main className="canvas-area">
        <div className="flow-stage" ref={stage}>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
            onNodeClick={(_, node) => { if (node.type === "screen") goTo(node.id); }}
            onEdgeClick={(_, edge) => goTo(edge.target, !!active)}
            onPaneClick={() => { browse(); select(null); }} onMove={(_, position) => setZoom(Math.round(position.zoom * 100))}
            onMoveStart={() => setMoving(true)} onMoveEnd={(_, position) => { setMoving(false); setViewport(position); }}
            minZoom={0.015} maxZoom={5} nodesConnectable={false} nodesDraggable={false} deleteKeyCode={null} nodeClickDistance={8} paneClickDistance={8}
            panOnScroll panOnDrag zoomOnPinch selectionKeyCode="Shift" zoomOnDoubleClick={false} autoPanOnNodeFocus={false} onlyRenderVisibleElements={false}>
            <Background gap={24} size={1} color="#c9cdd3" /><Controls showInteractive={false} showFitView={false} /><MiniMap pannable zoomable nodeColor={n => n.type === "section" ? "#e2e7ec" : "#87a8ad"} nodeStrokeWidth={0} />
            {journeyNode && entryUrl && <ViewportPortal><div className="journey-live nodrag nopan nowheel" style={{ left: journeyNode.position.x, top: journeyNode.position.y, width: 390, height: journeyNode.data.height }}>
              <LiveFrame key={player.state.key} id="journey" title="流程播放 · 真實 UI" url={entryUrl} viewport={journeyNode.data.viewport} epoch={player.state.key} runId={runId} interactive bridge={bridge} />
            </div></ViewportPortal>}
          </ReactFlow>
          <div className="canvas-hint">{player.state ? "播放中 · 鏡頭跟隨流程" : active ? "Interact · 按 Browse 鎖定畫面" : "Browse · 拖動畫布，雙指縮放；選取畫面後按 Interact"}</div><div className="zoom-label">{zoom}%</div>
        </div>
      </main>
      {inspector && <aside className="details-panel" aria-label="流程與資料"><div className="details-heading">流程與資料<button className="close" aria-label="收起右側資料" onClick={toggleRight}>›</button></div>
        <JourneyPanel definitions={project.journeys} selected={journeyId} onSelect={chooseJourney} player={player} branches={branches} onBranches={setBranches} coverage={coverage} scope={journeyId ? "all" : page} catalog={catalog} />
        {selected ? <Inspector selected={selected} page={pages.find(p => p.id === selected.pageId)} player={player} active={active} journeys={project.journeys} chooseJourney={chooseJourney} interact={interact} browse={browse} navigate={navigate} reset={() => player.state ? player.start() : setResets(old => ({ ...old, [selected.id]: (old[selected.id] || 0) + 1 }))} linked={linked} catalog={catalog} goTo={goTo} close={() => { browse(); select(null); }} retained={retained.includes(selected.id)} release={release} /> : <p className="selection-hint">點選畫面放大，或揀選流程播放。<br />Browse 可拖動畫布；Interact 可操作畫面。</p>}
      </aside>}
    </div>
  </PreviewContext.Provider>;
}
createRoot(document.getElementById("root")).render(<ReactFlowProvider><Canvas /></ReactFlowProvider>);
