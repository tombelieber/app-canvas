import { useTelemetry } from "./useTelemetry.js";
import { useI18n, I18nProvider } from "./i18n.jsx";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, MarkerType, ViewportPortal, useReactFlow, useViewport } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./canvas.css";
import { ScreenNode, GroupNode, PreviewContext } from "./ScreenNode.jsx";
import { layoutScreens } from "./layout.js";
import { cameraFor, screenBounds, overviewBounds } from "./navigation.js";
import { useBridge } from "./useBridge.js";
import { project, useManifest } from "./useManifest.js";
import { LiveFrame } from "./LiveFrame.jsx";
import { OverviewPlane } from "./OverviewPlane.jsx";
import { NativeOverviewPlane } from "./NativeOverviewPlane.jsx";
import { useJourney } from "./useJourney.js";
import { JourneyPanel } from "./JourneyPanel.jsx";
import { DemoPlayer } from "./DemoPlayer.jsx";
import { graphFlows, caseCoverage } from "../lib/coverage.mjs";
import { scopedScreens } from "../lib/pages.mjs";
import { journeyPlan } from "../lib/playback.mjs";
import { previewPool, visiblePreviews, renderedNodes } from "./preview-pool.js";
import { usePanelPreferences } from "./usePanelPreferences.js";
import { WorkspaceDock, ScopeToolbar, PageNavigator, Inspector } from "./WorkbenchChrome.jsx";
const nodeTypes = { screen: ScreenNode, section: GroupNode };
const minimapColor = n => n.type === "section" ? "#e2e7ec" : "#87a8ad";
const { catalog, pages } = project;
const flows = graphFlows(project), coverage = caseCoverage(project);
const runId = crypto.randomUUID();
const initialViewport = { x: 0, y: 0, zoom: .05 };

function Canvas() {
  const { t, locale } = useI18n();
  const analytics = useTelemetry(locale);
  // Use the graph's actual transform for preview culling and the shared
  // surface; a separately copied viewport can lag during touch gestures.
  const manifest = useManifest(), stage = useRef(null), camera = useReactFlow(), viewport = useViewport();
  const [page, setPage] = useState("all"), [query, setQuery] = useState("");
  const [selectedId, select] = useState(null), [active, setActive] = useState(null), [resets, setResets] = useState({});
  const [lines, setLines] = useState("related"), [request, setRequest] = useState(null);
  const [moving, setMoving] = useState(false), [area, setArea] = useState({ width: 800, height: 600 });
  const [journeyId, setJourneyId] = useState(""), [view, setView] = useState("overview"), [depth, setDepth] = useState(project.initialDepth || "all");
  const [branches, setBranches] = useState(false), [autoStart, setAutoStart] = useState(false);
  const [presenting, setPresenting] = useState(false), demoSnapshot = useRef(null);
  const [retained, retain] = useState([]), [notice, setNotice] = useState(""), [menu, setMenu] = useState(false), [drawer, setDrawer] = useState(false);
  const [previewErrors, setPreviewErrors] = useState({});
  const [nativeState, setNativeState] = useState(null);
  const receiveNativeState = useCallback((atlas, status) => setNativeState({ atlas, status }), []);
  const nativeIds = useMemo(() => new Set(manifest.nativeOverview?.cases.map(c => c.id) || []), [manifest.nativeOverview]);
  const nativePreview = nativeState?.atlas === manifest.nativeOverview && nativeState?.status === "ready";
  const nativePending = !!manifest.nativeOverview && (nativeState?.atlas !== manifest.nativeOverview || nativeState?.status === "loading");
  const nativeDetail = !!manifest.nativeOverview && viewport.zoom * 390 >= 120;
  const preferences = usePanelPreferences(`app-canvas:panels:${location.pathname}:${project.title}`);
  const limit = navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches ? 4 : 8;
  const cameraRun = useRef(0), previousNodes = useRef(new Map());
  const definition = project.journeys.find(j => j.id === journeyId);
  const plan = useMemo(() => journeyPlan(project, journeyId), [journeyId]);
  const journeyScreens = useMemo(() => definition && !branches ? [...new Set([definition.entry, ...definition.steps.map(s => s.screen)])] : null, [definition, branches]);
  const bridge = useBridge(() => { if (presenting) exitDemo(); else { setActive(null); player.stop(); } });
  const selected = catalog.find(s => s.id === selectedId);
  const visible = useMemo(() => scopedScreens(catalog, { page: journeyId ? "all" : page, query, depth: journeyId ? "all" : depth, selected: selectedId, journey: journeyScreens }), [page, query, depth, selectedId, journeyId, journeyScreens]);
  const navigate = useCallback((id, interact = false) => {
    const target = catalog.find(s => s.id === id); if (!target) return;
    if (interact && !retained.includes(id)) {
      if (retained.length >= limit - 1) { setNotice(t("Preview capacity reached. Release a retained preview in Panels before opening another.")); setMenu(true); interact = false; }
      else { retain(old => old.includes(id) ? old : [...old, id]); setNotice(""); }
    }
    select(id); setActive(interact ? id : null); setDrawer(false);
    if (target.pageId !== page) setPage(target.pageId);
    if (query && !`${target.id} ${target.title} ${target.feature}`.toLowerCase().includes(query.toLowerCase())) setQuery("");
    if (journeyScreens && !journeyScreens.includes(id)) setJourneyId("");
    setRequest({ id, nonce: performance.now() });
  }, [page, query, journeyScreens, retained, limit, t]);
  const player = useJourney({ definitions: plan, bridge, navigate });
  const browse = () => { setActive(null); player.stop(); };
  const goTo = (id, interact = false) => { analytics.track(interact ? "interaction_started" : "screen_selected"); player.stop(); navigate(id, interact); };
  const interact = (id = selectedId || catalog[0].id) => goTo(id, true);
  useEffect(() => { if (autoStart && plan.length) { player.start(false, { presentation: autoStart === "demo" }); setAutoStart(false); } }, [autoStart, plan]);
  const chooseJourney = (id, autoplay = false, demo = false) => { player.stop(); select(null); setActive(null); setPage("all"); setQuery(""); setJourneyId(id); setBranches(id.startsWith("__")); setAutoStart(autoplay ? demo ? "demo" : "journey" : false); };
  const startDemo = () => {
    analytics.track("flow_started");
    demoSnapshot.current = { page, query, selectedId, active, journeyId, branches, viewport: camera.getViewport() };
    setPresenting(true); setMenu(false); setDrawer(false);
    const pageScope = `__page__:${page}`;
    chooseJourney(plan.length ? journeyId : page !== "all" && journeyPlan(project, pageScope).length ? pageScope : "__all__", true, true);
  };
  const exitDemo = () => {
    player.stop(); setAutoStart(false); setPresenting(false);
    const saved = demoSnapshot.current;
    if (saved) { setPage(saved.page); setQuery(saved.query); select(saved.selectedId); setActive(saved.active); setJourneyId(saved.journeyId); setBranches(saved.branches); }
  };
  const nodes = useMemo(() => {
    const groups = pages.map((p, i) => ({ ...p, color: project.groups[i % project.groups.length].color }));
    const grouped = visible.map(s => ({ ...s, group: s.pageId }));
    const layout = layoutScreens(grouped, manifest, groups, { mode: view === "machine" ? "machine" : "overview", flows, focusedId: selectedId, nativeOverview: !!manifest.nativeOverview, area });
    const ids = new Set(visible.map(s => s.id));
    const placed = layout.map(node => {
      if (node.type !== "screen") return node;
      const native = node.id === selectedId || node.id === active || node.id === player.state?.screen || journeyScreens?.includes(node.id);
      if (journeyScreens?.includes(node.id)) node = { ...node, position: { x: journeyScreens.indexOf(node.id) * 670, y: 90 } };
      if (native) {
        const height = node.data.screen.viewport?.height || 844, width = node.data.viewport.width;
        node = { ...node, initialWidth: 390, initialHeight: height * 390 / width + 48, data: { ...node.data, compact: false, width: 390, viewport: { width, height }, height: height * 390 / width }, style: { width: 390, height: height * 390 / width + 48 } };
      }
      node = { ...node, data: { ...node.data, visible: true, nativePreview: nativePreview && nativeIds.has(node.id) && !node.data.error, nativePending: nativePending && nativeIds.has(node.id), nativeDetail } };
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
  }, [visible, manifest, view, selectedId, active, player.state?.screen, journeyScreens, depth, area, nativePreview, nativePending, nativeIds, nativeDetail]);
  const previews = useMemo(() => visiblePreviews(nodes, viewport, area), [nodes, viewport, area]);
  const mounted = useMemo(() => {
    const ids = previewPool({ nodes, viewport, area, selected: selectedId, active, retained, limit, playing: !!player.state });
    // Legacy manifests and drawing surfaces that cannot be represented by
    // HTML/CSS retain their actual app, never a blank or fabricated thumbnail.
    if (!player.state) for (const node of nodes) if (ids.size < limit && previews.has(node.id) && node.data.url && !node.data.domUrl && !node.data.nativePending && (!node.data.nativePreview || node.data.nativeDetail)) ids.add(node.id);
    return ids;
  }, [nodes, previews, viewport, area, selectedId, active, retained, limit, !!player.state]);
  const cardNodes = useMemo(() => renderedNodes(nodes, previews, mounted), [nodes, previews, mounted]);
  const fit = useCallback(() => setRequest({ id: null, nonce: performance.now() }), []);
  useEffect(() => { if (nativePreview && !selectedId && !journeyId) fit(); }, [nativePreview, fit]);
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const r = entries[0].contentRect, restore = !presenting && demoSnapshot.current;
      setArea({ width: r.width, height: r.height });
      setRequest({ id: selectedId, viewport: restore?.viewport, nonce: performance.now() });
      if (restore) demoSnapshot.current = null;
    });
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, [selectedId, presenting]);
  useLayoutEffect(() => {
    if (!request || !camera.viewportInitialized || !stage.current || !nodes.length) return;
    const node = request.id && nodes.find(n => n.id === request.id);
    if (request.id && !node) return;
    const visibleNodes = nodes.filter(n => n.type === "screen" && n.data.visible);
    if (!node && !visibleNodes.length) { setRequest(null); return; }
    const bounds = node && presenting ? { x: node.position.x, y: node.position.y - 42, width: 390, height: node.data.height + 60 } : node ? screenBounds(node) : overviewBounds(visibleNodes);
    const position = request.viewport || cameraFor(bounds, stage.current.getBoundingClientRect(), { padding: node ? 40 : 35, maxZoom: node ? 4 : 1, minZoom: manifest.nativeOverview ? .001 : .015 });
    const currentCamera = ++cameraRun.current; setMoving(true);
    camera.setViewport(position, { duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240 }).finally(() => { if (cameraRun.current === currentCamera) setMoving(false); });
    setRequest(null);
  }, [request, nodes, camera]);
  useEffect(() => { if (!selectedId) fit(); }, [manifest.status, fit]);
  useEffect(fit, [journeyId, view, depth, branches]);
  useEffect(() => {
    if (!presenting && demoSnapshot.current) setRequest({ viewport: demoSnapshot.current.viewport, nonce: performance.now() });
  }, [presenting]);
  const selectPage = id => { browse(); setJourneyId(""); setPage(id); setQuery(""); select(null); setDrawer(false); fit(); };
  const search = value => { browse(); setJourneyId(""); setPage("all"); setQuery(value); select(null); fit(); };
  const changeView = next => { setView(next);  if (next === "machine") setBranches(true); };
  const release = id => {
    if (!confirm(t("Release this synthetic preview? Unsaved input and changes will be cleared."))) return;
    retain(old => old.filter(x => x !== id)); setResets(old => ({ ...old, [id]: (old[id] || 0) + 1 })); if (active === id) setActive(null); setNotice("");
  };
  useEffect(() => {
    const key = event => {
      if (event.key === "Escape") { if (presenting) exitDemo(); else { setActive(null); player.stop(); } setMenu(false); setDrawer(false); return; }
      if (presenting) return;
      if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.key === "1") { event.preventDefault(); fit(); }
      if (event.key === "2" && selectedId) { event.preventDefault(); navigate(selectedId, !!active); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [fit, navigate, selectedId, active, presenting]);
  const trackedPlayback = useRef(null);
  useEffect(() => { if (player.state?.status === "complete" && trackedPlayback.current !== player.state.playbackId) { trackedPlayback.current = player.state.playbackId; analytics.track("flow_completed"); } }, [player.state?.status, player.state?.playbackId]);
  const shown = new Set(visible.map(s => s.id));
  const journeyFlows = !branches && definition?.steps.map((step, i) => ({ from: i ? definition.steps[i - 1].screen : definition.entry, to: step.screen, label: step.title })).filter(edge => edge.from !== edge.to);
  const displayedFlows = journeyFlows || flows;
  const edges = lines === "none" ? [] : displayedFlows.filter(f => shown.has(f.from) && shown.has(f.to) && (journeyId || lines === "all" || f.from === selectedId || f.to === selectedId)).map((f, i) => ({
    id: `flow-${i}`, source: f.from, target: f.to, label: `${f.kind === "condition" ? t("Condition:") : f.kind === "reference" ? t("Reference:") : ""}${f.label || ""}`, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed, color: "#5d7ca5" },
    animated: player.state?.trace.at(-1)?.from === f.from && player.state?.trace.at(-1)?.to === f.to,
    style: { stroke: f.from === selectedId || f.to === selectedId ? "#287b83" : f.kind === "recovery" ? "#277d50" : "#7892ad", strokeDasharray: ["condition", "reference"].includes(f.kind) ? "10 6" : undefined, strokeWidth: f.from === selectedId || f.to === selectedId ? 3 : 2 }, labelStyle: { fontSize: 15, fill: "#33516d" }, labelBgPadding: [10, 6], labelBgBorderRadius: 5,
  }));
  const linked = displayedFlows.filter(f => f.from === selectedId || f.to === selectedId);
  const rendered = Object.values(manifest.screens || {}).filter(s => !s.error).length;
  const context = { bridge, selected: selectedId, active, resets, revision: manifest.revision, runId, mounted, previews, previewErrors };
  const journeyNode = player.state && nodes.find(node => node.id === player.state.screen), entryUrl = player.state && manifest.screens[player.state.definition.entry]?.url;
  const inspector = preferences.panels.right;
  const toggleRight = () => preferences.toggle("right");
  return <PreviewContext.Provider value={context}>
    <div className={`review-workspace ${presenting ? "is-presenting" : ""} ${inspector ? "has-inspector" : ""} ${preferences.panels.left ? "has-navigation" : ""} ${preferences.panels.top ? "has-top" : ""} ${drawer ? "drawer-open" : ""}`} data-view={view} data-mode={active ? "interact" : "browse"} data-preview-limit={limit} data-live-count={mounted.size + (player.state ? 1 : 0)} data-camera-ready={!moving && !request} data-live-ready={manifest.status === "ready" && [...mounted].every(id => bridge.states[id]?.ready && !bridge.states[id]?.error)}>
      <header className={preferences.panels.top ? "workspace-bar" : "workspace-floating"}>
        <WorkspaceDock preferences={preferences} menu={menu} setMenu={setMenu} drawer={drawer} setDrawer={setDrawer} active={active} browse={browse} interact={() => interact()} retained={retained} release={release} catalog={catalog} notice={notice} limit={limit} view={view} setView={changeView} fit={fit} rightOpen={inspector} toggleRight={toggleRight} startDemo={startDemo} demoReady={manifest.status === "ready" && !!project.journeys.length} hasJourneys={!!project.journeys.length}
          analytics={analytics} brand={<div className="workspace-identity"><a className="workspace-brand" href="./">{project.title}</a><span className={`sync-status ${manifest.status === "ready" ? "ready" : ""}`}><i />{manifest.status === "ready" ? t("{0} screens · {1}", rendered, project.static ? t("Demo build") : t("Synced")) : manifest.status === "error" ? t("Load failed") : t("Loading {0} / {1}", rendered, catalog.length)}</span></div>} />
      </header>
      {preferences.panels.left && <><button className="drawer-backdrop" aria-label={t("Close navigation")} onClick={() => setDrawer(false)} /><PageNavigator pages={pages} catalog={catalog} page={page} query={query} selectPage={selectPage} selectedId={selectedId} goTo={goTo} lines={lines} setLines={setLines} links={project.links} close={() => { setDrawer(false); preferences.toggle("left"); }}>
        <ScopeToolbar pages={pages} page={page} setPage={selectPage} query={query} search={search} depth={depth} setDepth={setDepth} />
      </PageNavigator></>}
      <main className="canvas-area">
        <div className="flow-stage" ref={stage}>
          <ReactFlow ariaLabelConfig={{ "controls.ariaLabel": t("Panels"), "controls.zoomIn.ariaLabel": t("Zoom in"), "controls.zoomOut.ariaLabel": t("Zoom out"), "minimap.ariaLabel": t("Minimap") }} defaultViewport={initialViewport} nodes={cardNodes} edges={edges} nodeTypes={nodeTypes}
            onNodeClick={(_, node) => { if (node.type === "screen") goTo(node.id); }}
            onEdgeClick={(_, edge) => goTo(edge.target, !!active)}
            onPaneClick={() => { browse(); select(null); }}
            onMoveStart={() => setMoving(true)} onMoveEnd={() => setMoving(false)}
            minZoom={manifest.nativeOverview ? .001 : .015} maxZoom={5} nodesConnectable={false} nodesDraggable={false} deleteKeyCode={null} nodeClickDistance={8} paneClickDistance={8}
            panOnScroll panOnDrag zoomOnPinch selectionKeyCode="Shift" zoomOnDoubleClick={false} autoPanOnNodeFocus={false} onlyRenderVisibleElements={false}>
            <Background gap={24} size={1} color="#c9cdd3" /><Controls showInteractive={false} showFitView={false} /><MiniMap pannable zoomable nodeColor={minimapColor} nodeStrokeWidth={0} />
            <OverviewPlane nodes={nodes} viewport={viewport} area={area} previews={previews} mounted={mounted} liveScreen={player.state?.screen} revision={manifest.revision} onError={setPreviewErrors} />
            <NativeOverviewPlane atlas={manifest.nativeOverview} error={manifest.nativeOverviewError} nodes={nodes} viewport={viewport} area={area} mounted={mounted} liveScreen={player.state?.screen} onReady={receiveNativeState} />
            {journeyNode && entryUrl && <ViewportPortal><div className="journey-live nodrag nopan nowheel" style={{ left: journeyNode.position.x, top: journeyNode.position.y, width: 390, height: journeyNode.data.height }}>
              <LiveFrame key={player.state.key} id="journey" title={t("Flow playback · real UI")} url={entryUrl} viewport={journeyNode.data.viewport} epoch={player.state.key} runId={runId} interactive bridge={bridge} presentation={presenting} />
            </div></ViewportPortal>}
          </ReactFlow>
          <div className="canvas-hint">{player.state ? t("Playing · camera follows flow") : active ? t("Interact · choose Browse to lock controls") : t("Browse · pan and pinch to zoom; select a screen, then Interact")}</div><div className="zoom-label">{Math.round(viewport.zoom * 100)}%</div>
          {presenting && <div className="demo-shield" aria-hidden="true" />}
        </div>
        {presenting && <DemoPlayer player={player} definitions={plan} title={project.title} catalog={catalog} pages={pages} journeys={project.journeys} selected={journeyId} onSelect={id => chooseJourney(id, true, true)} onReplay={() => player.start(false, { presentation: true })} onExit={exitDemo} />}
      </main>
      {inspector && <aside className="details-panel" aria-label={t("Flows and details")}><div className="details-heading">{t("Flows and details")}<button className="close" aria-label={t("Collapse details")} onClick={toggleRight}>›</button></div>
        <JourneyPanel definitions={project.journeys} selected={journeyId} onSelect={chooseJourney} player={player} branches={branches} onBranches={setBranches} coverage={coverage} scope={journeyId ? "all" : page} catalog={catalog} pages={pages} />
        {selected ? <Inspector selected={selected} page={pages.find(p => p.id === selected.pageId)} player={player} active={active} journeys={project.journeys} chooseJourney={chooseJourney} interact={interact} browse={browse} navigate={navigate} reset={() => player.state ? player.start() : setResets(old => ({ ...old, [selected.id]: (old[selected.id] || 0) + 1 }))} linked={linked} catalog={catalog} goTo={goTo} close={() => { browse(); select(null); }} retained={retained.includes(selected.id)} release={release} /> : <p className="selection-hint">{t("Select a screen to zoom, or choose a flow to play.")}<br />{t("Browse pans the canvas; Interact uses the screen.")}</p>}
      </aside>}
    </div>
  </PreviewContext.Provider>;
}
createRoot(document.getElementById("root")).render(<ReactFlowProvider><I18nProvider><Canvas /></I18nProvider></ReactFlowProvider>);
