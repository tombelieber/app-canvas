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
const nodeTypes = { screen: ScreenNode, section: GroupNode };
const { catalog, groups, flows } = project;
const runId = crypto.randomUUID();

function Canvas() {
  const manifest = useManifest();
  const [group, setGroup] = useState("all"), [query, setQuery] = useState("");
  const [selectedId, select] = useState(null), [active, setActive] = useState(null), [resets, setResets] = useState({});
  const [lines, setLines] = useState(true), [zoom, setZoom] = useState(100), [request, setRequest] = useState(null);
  const [moving, setMoving] = useState(false);
  const cameraRun = useRef(0);
  const [journeyId, setJourneyId] = useState("");
  const definition = project.journeys.find((j) => j.id === journeyId);
  const journeyScreens = useMemo(() => definition ? [...new Set([definition.entry, ...definition.steps.map((s) => s.screen)])] : null, [definition]);
  const stage = useRef(null), camera = useReactFlow();
  const bridge = useBridge(() => { setActive(null); player.stop(); });
  const visible = useMemo(() => catalog.filter((s) => (group === "all" || s.group === group) && (!query || `${s.title} ${s.id}`.toLowerCase().includes(query.toLowerCase())) && (!journeyScreens || journeyScreens.includes(s.id))), [group, query, journeyScreens]);
  const selected = catalog.find((s) => s.id === selectedId);
  const nodes = useMemo(() => {
    const ids = new Set(visible.map((s) => s.id)), groupIds = new Set(visible.map((s) => `group-${s.group}`));
    // Freeze each overview at its source-build measurement. Feeding live scroll
    // height back into vh-based apps can grow the iframe on every resize.
    return layoutScreens(catalog, manifest, groups).map((node) => {
      if (journeyScreens?.includes(node.id) || node.id === active) {
        const height = node.data.screen.viewport?.height || 844;
        node = { ...node, initialHeight: height * 390 / node.data.viewport.width + 48, position: journeyScreens?.includes(node.id) ? { x: journeyScreens.indexOf(node.id) * 560, y: 90 } : node.position, data: { ...node.data, viewport: { ...node.data.viewport, height }, height: height * 390 / node.data.viewport.width }, style: { ...node.style, height: height * 390 / node.data.viewport.width + 48 } };
      }
      return { ...node, style: { ...node.style, visibility: ids.has(node.id) || (!journeyScreens && groupIds.has(node.id)) ? "visible" : "hidden" } };
    });
  }, [visible, manifest, journeyScreens, active]);
  const navigate = useCallback((id, interact = false) => {
    if (!catalog.some((s) => s.id === id)) return;
    select(id); setActive(interact ? id : null);
    if (!visible.some((s) => s.id === id)) { setGroup("all"); setQuery(""); }
    if (journeyScreens && !journeyScreens.includes(id)) setJourneyId("");
    setRequest({ id, nonce: performance.now() });
  }, [visible, journeyScreens]);
  const player = useJourney({ definition, bridge, navigate });
  const goTo = (id, interact = false) => { player.stop(); navigate(id, interact); };
  const fit = useCallback(() => setRequest({ id: null, nonce: performance.now() }), []);
  useEffect(() => {
    const observer = new ResizeObserver(() => setRequest({ id: selectedId, nonce: performance.now() }));
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, [selectedId]);
  useLayoutEffect(() => {
    if (!request || !camera.viewportInitialized || !stage.current || !nodes.length) return;
    const node = request.id && nodes.find((n) => n.id === request.id);
    if (request.id && !node) return;
    const area = stage.current.getBoundingClientRect();
    const visibleNodes = nodes.filter((n) => n.type === "screen" && n.style.visibility !== "hidden");
    if (!node && !visibleNodes.length) { setRequest(null); return; }
    const bounds = node ? screenBounds(node) : overviewBounds(visibleNodes);
    const position = cameraFor(bounds, area, { padding: node ? 40 : 35, maxZoom: node ? 4 : 1 });
    const currentCamera = ++cameraRun.current;
    setMoving(true);
    camera.setViewport(position, { duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 300 }).finally(() => { if (cameraRun.current === currentCamera) setMoving(false); });
    setRequest(null);
  }, [request, nodes, camera, selectedId]);
  useEffect(() => { if (!selectedId) fit(); }, [manifest.status, fit]);
  useEffect(fit, [journeyId]);
  const filterGroup = (id) => { player.stop(); setJourneyId(""); setGroup(id); setQuery(""); select(null); setActive(null); fit(); };
  const search = (value) => { player.stop(); setJourneyId(""); setQuery(value); select(null); setActive(null); fit(); };
  useEffect(() => {
    const key = (event) => {
      if (event.key === "Escape") { setActive(null); player.stop(); return; }
      if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.key === "1") { event.preventDefault(); fit(); }
      if (event.key === "2" && selectedId) { event.preventDefault(); navigate(selectedId, !!active); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [fit, navigate, selectedId, active]);
  const shown = new Set(visible.map((s) => s.id));
  const journeyFlows = definition?.steps.map((step, i) => ({ from: i ? definition.steps[i - 1].screen : definition.entry, to: step.screen, label: step.title })).filter((edge) => edge.from !== edge.to);
  const displayedFlows = journeyFlows || flows;
  const edges = lines ? displayedFlows.filter((f) => shown.has(f.from) && shown.has(f.to)).map((f, i) => ({
    id: `flow-${i}`, source: f.from, target: f.to, label: f.label, type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#5d7ca5" },
    style: { stroke: f.from === selectedId || f.to === selectedId ? "#287b83" : "#7892ad", strokeWidth: f.from === selectedId || f.to === selectedId ? 4 : 2 },
    labelStyle: { fontSize: 15, fill: "#33516d" }, labelBgPadding: [10, 6], labelBgBorderRadius: 5,
  })) : [];
  const linked = displayedFlows.filter((f) => f.from === selectedId || f.to === selectedId);
  const rendered = Object.values(manifest.screens || {}).filter((s) => !s.error).length;
  const context = { bridge, selected: selectedId, active, resets, revision: manifest.revision, runId };
  const journeyNode = player.state && nodes.find((node) => node.id === player.state.screen);
  const entryUrl = player.state && manifest.screens[player.state.definition.entry]?.url;
  return <PreviewContext.Provider value={context}>
    <div className={`review-workspace ${selected ? "has-inspector" : ""}`} data-camera-ready={!moving && !request} data-live-ready={catalog.every((s) => bridge.states[s.id]?.ready && !bridge.states[s.id]?.error)}>
      <header className="workspace-bar">
        <a className="workspace-brand" href="./">{project.title} <span>LIVE UI canvas</span></a>
        <span className={`sync-status ${manifest.status === "ready" ? "ready" : ""}`}><i />{manifest.status === "ready" ? `${rendered} 個畫面 · ${project.static ? "示範版本" : "已同步"}` : manifest.status === "error" ? "載入失敗" : `正在載入 ${rendered} / ${catalog.length}`}</span>
        <div className="bar-actions"><button onClick={fit}>全覽 <kbd>1</kbd></button><button className="present" onClick={() => goTo(selectedId || catalog[0].id, true)}>▶ 操作 App</button></div>
      </header>
      <aside className="layers-panel">
        <div className="layers-heading">畫面與狀態 <span>{catalog.length}</span></div>
        <input aria-label="搜尋畫面" placeholder="搜尋畫面或狀態…" value={query} onChange={(e) => search(e.target.value)} />
        <button className={`group-choice ${group === "all" ? "active" : ""}`} onClick={() => filterGroup("all")}><span>▦</span>全部畫面 <small>{catalog.length}</small></button>
        <div className="layer-groups">{groups.map((g) => <section key={g.id}>
          <button className={`group-choice ${group === g.id ? "active" : ""}`} onClick={() => filterGroup(g.id)}><i style={{ background: g.color }} />{g.title}<small>{catalog.filter((s) => s.group === g.id).length}</small></button>
          {(group === g.id || query) && visible.filter((s) => s.group === g.id).map((s) => <button key={s.id} title={s.id} className={`layer-screen ${selectedId === s.id ? "active" : ""}`} onClick={() => goTo(s.id)} onDoubleClick={() => goTo(s.id, true)}>{s.title}</button>)}
        </section>)}</div>
        <div className="layers-foot"><strong>真實 HTML / CSS / JS · 全部 LIVE</strong><p>{project.static ? "公開 demo 使用固定版本 App code 同虛構資料。" : "畫面由 App code 直接 render；修改 source 後重新載入。"}</p>
          {project.links?.repository && <p><a href={project.links.repository} target="_blank" rel="noreferrer">GitHub ↗</a> · <a href={project.links.agentGuide} target="_blank" rel="noreferrer">交畀你的 Agent ↗</a></p>}
          <label><input type="checkbox" checked={lines} onChange={(e) => setLines(e.target.checked)} />顯示流程連線</label>
        </div>
      </aside>
      <main className="canvas-area">
        <JourneyPanel definitions={project.journeys} selected={journeyId} onSelect={(id) => { player.stop(); select(null); setActive(null); setGroup("all"); setQuery(""); setJourneyId(id); }} player={player} />
        <div className="flow-stage" ref={stage}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodeClick={(_, node) => { if (node.type === "screen") goTo(node.id); }}
          onNodeDoubleClick={(_, node) => { if (node.type === "screen") goTo(node.id, true); }}
          onEdgeClick={(_, edge) => goTo(edge.target, !!active)}
          onPaneClick={() => { player.stop(); setActive(null); select(null); }} onMove={(_, view) => setZoom(Math.round(view.zoom * 100))}
          onMoveStart={() => setMoving(true)} onMoveEnd={() => setMoving(false)}
          minZoom={0.015} maxZoom={5} nodesConnectable={false} nodesDraggable={false} deleteKeyCode={null}
          panOnScroll panOnDrag selectionKeyCode="Shift" zoomOnDoubleClick={false} autoPanOnNodeFocus={false} onlyRenderVisibleElements={false}>
          <Background gap={24} size={1} color="#c9cdd3" /><Controls showInteractive={false} showFitView={false} /><MiniMap pannable zoomable nodeColor={(n) => n.type === "section" ? "#e2e7ec" : "#87a8ad"} nodeStrokeWidth={0} />
          {journeyNode && entryUrl && <ViewportPortal><div className="journey-live nodrag nopan nowheel" style={{ left: journeyNode.position.x, top: journeyNode.position.y, width: 390, height: journeyNode.data.height }}>
            <LiveFrame key={player.state.key} id="journey" title="流程播放 · 真實 UI" url={entryUrl} viewport={journeyNode.data.viewport} epoch={player.state.key} runId={runId} interactive bridge={bridge} />
          </div></ViewportPortal>}
        </ReactFlow>
        <div className="canvas-hint">{player.state ? "播放預覽 · 可原位操作 · 流程連結會退出播放" : active ? "正在原位操作真實 UI · Esc 返回瀏覽" : "拖移平移 · Ctrl / ⌘ 滾輪縮放 · 雙擊畫面原位操作"}</div><div className="zoom-label">{zoom}%</div>
        </div>
      </main>
      {selected && <aside className="inspector">
        <button className="close" aria-label="關閉畫面資料" onClick={() => { player.stop(); select(null); setActive(null); }}>×</button>
        <span className="inspector-kicker">{player.state ? "流程播放 · LIVE" : active ? "互動模式 · LIVE" : "瀏覽模式 · LIVE"}</span><h2>{selected.title}</h2><code>{selected.id}</code>
        <button className="present" onClick={() => active ? setActive(null) : goTo(selected.id, true)}>{active ? "停止操作 · 保留畫面" : "▶ 操作呢個畫面"}</button>
        <button onClick={() => navigate(selected.id, !!active)}>放大至畫面 <kbd>2</kbd></button>
        <button onClick={() => player.state ? player.start() : setResets((old) => ({ ...old, [selected.id]: (old[selected.id] || 0) + 1 }))}>重設</button>
        <h3>實際 UI 來源</h3><p className="source-file">{selected.source || "Application source"}</p>
        {selected.experimental && <p className="experimental">模擬合資格 UI；唔代表正式 AI 已啟用。</p>}
        <h3>流程連接</h3>{linked.length ? linked.map((f, i) => <button className="flow-link" key={i} onClick={() => goTo(f.from === selected.id ? f.to : f.from, !!active)}><small>{f.from === selected.id ? "下一步" : "上一步"} · {f.label}</small><span>{catalog.find((s) => s.id === (f.from === selected.id ? f.to : f.from))?.title} ↗</span></button>) : <p>可直接操作畫面嘅原有控制項。</p>}
        <p className="prototype-note">操作只影響呢個虛構預覽。切換分類會保留已填內容；按重設還原呢個狀態。Esc 返回瀏覽。</p>
      </aside>}
    </div>
  </PreviewContext.Provider>;
}
createRoot(document.getElementById("root")).render(<ReactFlowProvider><Canvas /></ReactFlowProvider>);
