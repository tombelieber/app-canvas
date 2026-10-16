import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useReactFlow,
  useNodesState,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./canvas.css";
const resource = (name) => new URL(`../${name}`, import.meta.url);
const project = await (await fetch(resource("project.json"))).json();
const { catalog, flows, groups } = project;

function ScreenNode({ id, data, selected }) {
  const s = data.screen;
  return (
    <article
      className={`screen-frame ${selected ? "is-selected" : ""}`}
      style={{ width: data.width || 390 }}
    >
      <Handle type="target" position={Position.Left} />
      <header className="frame-label">
        <span>{s.title}</span>
        <small>{s.experimental ? "模擬條件" : s.id}</small>
      </header>
      <div
        className="screen-surface"
        style={{ height: data.height, width: data.width || 390 }}
      >
        {data.error ? (
          <div className="render-error">畫面未能生成：{data.error}</div>
        ) : data.image ? (
          <img
            src={data.image}
            style={{ width: data.width || 390 }}
            width={data.width || 390}
            height={data.height}
            alt={s.title}
            draggable="false"
          />
        ) : (
          <div className="render-pending">正在由 App code 生成畫面…</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}
function GroupNode({ data }) {
  return (
    <div className="board-group">
      <h2 style={{ color: data.color }}>
        {data.title} <span>{data.count} 個畫面</span>
      </h2>
    </div>
  );
}
const nodeTypes = { screen: ScreenNode, section: GroupNode };

export function layoutScreens(screens, manifest) {
  const nodes = [],
    blocks = [],
    skyline = Array(20).fill(0);
  for (const g of groups) {
    const members = screens.filter((s) => s.group === g.id);
    if (!members.length) continue;
    const columns =
        g.id === "app"
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
    for (let n = 0; n <= 20 - columns; n++) {
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
          width: 390,
          height: h,
          image: m.image,
          error: m.error,
        },
        style: { width: 390, height: h + 48 },
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
      zIndex: -1,
      selectable: false,
      draggable: false,
    });
    for (let n = slot; n < slot + columns; n++)
      skyline[n] = blockY + height + 180;
  }
  return [...blocks, ...nodes];
}
const sourceFor = (s) => s.source || "Application source";

function Canvas() {
  const [manifest, setManifest] = useState({ screens: {}, status: "building" }),
    [group, setGroup] = useState("all"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState(null),
    [play, setPlay] = useState(null),
    [key, setKey] = useState(0),
    [lines, setLines] = useState(true),
    [zoom, setZoom] = useState(100);
  const [nodes, setNodes, onNodesChange] = useNodesState([]),
    flow = useReactFlow();
  const loadedHash = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const update = (next) => {
      if (cancelled) return;
      if (next.canvasHash) {
        if (loadedHash.current && loadedHash.current !== next.canvasHash) {
          location.reload();
          return;
        }
        loadedHash.current = next.canvasHash;
      }
      setManifest(next);
    };
    if (project.static) {
      fetch(resource("manifest.json")).then((r) => {
        if (!r.ok) throw Error("Manifest unavailable");
        return r.json();
      }).then(update).catch((error) => update({ status: "error", screens: {}, error: error.message }));
      return () => { cancelled = true; };
    }
    const events = new EventSource(resource("events"));
    events.onmessage = (e) => update(JSON.parse(e.data));
    return () => { cancelled = true; events.close(); };
  }, []);
  useEffect(() => {
    const listener = (e) => {
      if (
        e.data?.type === "review-exit" &&
        e.source ===
          document.querySelector(".prototype-body iframe")?.contentWindow
      )
        setPlay(null);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  const visible = useMemo(
    () =>
      catalog.filter(
        (s) =>
          (group === "all" || s.group === group) &&
          (!query ||
            `${s.title} ${s.id}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [group, query],
  );
  useEffect(() => {
    setNodes(layoutScreens(visible, manifest));
  }, [visible, manifest, setNodes]);
  const fit = useCallback(
    () =>
      flow.fitView({
        padding: 0.07,
        duration: 250,
        minZoom: 0.015,
        maxZoom: 1,
      }),
    [flow],
  );
  useEffect(() => {
    const t = setTimeout(fit, 100);
    return () => clearTimeout(t);
  }, [group, query, manifest.status, fit]);
  const ids = new Set(visible.map((s) => s.id));
  const edges = lines
    ? flows
        .filter((f) => ids.has(f.from) && ids.has(f.to))
        .map((f, i) => ({
          id: `flow-${i}`,
          source: f.from,
          target: f.to,
          label: f.label,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#5d7ca5" },
          style: { stroke: "#6f8eb8", strokeWidth: 2 },
          labelStyle: { fontSize: 15, fill: "#33516d" },
          labelBgPadding: [10, 6],
          labelBgBorderRadius: 5,
          animated: false,
        }))
    : [];
  const focus = (id) => {
    const s = catalog.find((s) => s.id === id);
    if (!s) return;
    setSelected(s);
    const node = flow.getNode(id);
    if (node)
      flow.fitView({
        nodes: [node],
        padding: 0.2,
        duration: 300,
        maxZoom: 0.85,
      });
    else {
      setGroup("all");
      setQuery("");
      setTimeout(() => {
        const n = flow.getNode(id);
        if (n)
          flow.fitView({
            nodes: [n],
            padding: 0.2,
            duration: 300,
            maxZoom: 0.85,
          });
      }, 150);
    }
  };
  const linked = selected
    ? flows.filter((f) => f.from === selected.id || f.to === selected.id)
    : [];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setPlay(null);
        setSelected(null);
      }
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "1") {
        e.preventDefault();
        fit();
      }
      if (e.key === "2" && selected) {
        e.preventDefault();
        focus(selected.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const rendered = Object.values(manifest.screens || {}).filter(
    (s) => !s.error,
  ).length;
  return (
    <div className="review-workspace">
      <header className="workspace-bar">
        <a className="workspace-brand" href="./">
          {project.title} <span>UI canvas</span>
        </a>
        <span
          className={`sync-status ${manifest.status === "ready" ? "ready" : ""}`}
        >
          <i />
          {manifest.status === "ready"
            ? `${rendered} 個畫面 · ${project.static ? "示範版本" : "已同步"}`
            : manifest.status === "error"
              ? "生成失敗"
              : `正在生成 ${rendered} / ${catalog.length}`}
        </span>
        <div className="bar-actions">
          <button onClick={fit}>
            全覽 <kbd>1</kbd>
          </button>
          <button
            className="present"
            onClick={() => {
              setPlay(selected?.id || catalog[0].id);
              setKey((k) => k + 1);
            }}
          >
            ▶ 操作 App
          </button>
        </div>
      </header>
      <aside className="layers-panel">
        <div className="layers-heading">
          畫面與狀態 <span>{catalog.length}</span>
        </div>
        <input
          aria-label="搜尋畫面"
          placeholder="搜尋畫面或狀態…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className={`group-choice ${group === "all" ? "active" : ""}`}
          onClick={() => setGroup("all")}
        >
          <span>▦</span>全部畫面 <small>{catalog.length}</small>
        </button>
        <div className="layer-groups">
          {groups.map((g) => (
            <section key={g.id}>
              <button
                className={`group-choice ${group === g.id ? "active" : ""}`}
                onClick={() => setGroup(g.id)}
              >
                <i style={{ background: g.color }} />
                {g.title}
                <small>{catalog.filter((s) => s.group === g.id).length}</small>
              </button>
              {(group === g.id || query) &&
                visible
                  .filter((s) => s.group === g.id)
                  .map((s) => (
                    <button
                      key={s.id}
                      title={s.id}
                      className={`layer-screen ${selected?.id === s.id ? "active" : ""}`}
                      onClick={() => focus(s.id)}
                      onDoubleClick={() => setPlay(s.id)}
                    >
                      {s.title}
                    </button>
                  ))}
            </section>
          ))}
        </div>
        <div className="layers-foot">
          <strong>同一份 App UI code</strong>
          <p>{project.static ? "公開 demo：固定版本 UI、虛構資料。接入你嘅 repo 後，畫面會跟程式更新。" : "預覽全部係虛構資料。修改程式後自動重建畫面。"}</p>
          {project.links?.repository && <p><a href={project.links.repository} target="_blank" rel="noreferrer">GitHub ↗</a> · <a href={project.links.agentGuide} target="_blank" rel="noreferrer">交畀你的 Agent ↗</a></p>}
          <label>
            <input
              type="checkbox"
              checked={lines}
              onChange={(e) => setLines(e.target.checked)}
            />
            顯示流程連線
          </label>
        </div>
      </aside>
      <main className="canvas-area">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => {
            if (node.type === "screen") setSelected(node.data.screen);
          }}
          onNodeDoubleClick={(_, node) => {
            if (node.type === "screen") {
              setSelected(node.data.screen);
              setPlay(node.id);
              setKey((k) => k + 1);
            }
          }}
          onPaneClick={() => setSelected(null)}
          onMove={(_, v) => setZoom(Math.round(v.zoom * 100))}
          minZoom={0.015}
          maxZoom={1.5}
          fitView
          fitViewOptions={{ minZoom: 0.015, padding: 0.07 }}
          nodesConnectable={false}
          nodesDraggable={false}
          deleteKeyCode={null}
          panOnScroll
          panOnDrag={true}
          selectionKeyCode="Shift"
          zoomOnDoubleClick={false}
          onlyRenderVisibleElements
        >
          <Background gap={24} size={1} color="#c9cdd3" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => (n.type === "section" ? "#e2e7ec" : "#87a8ad")}
            nodeStrokeWidth={0}
          />
        </ReactFlow>
        <div className="canvas-hint">
          拖移空白處 / 觸控板平移 · Ctrl / ⌘ 滾輪縮放 · 雙擊畫面操作
        </div>
        <div className="zoom-label">{zoom}%</div>
      </main>
      {selected && !play && (
        <aside className="inspector">
          <button
            className="close"
            aria-label="關閉畫面資料"
            onClick={() => setSelected(null)}
          >
            ×
          </button>
          <span className="inspector-kicker">畫面</span>
          <h2>{selected.title}</h2>
          <code>{selected.id}</code>
          <button
            className="present"
            onClick={() => {
              setPlay(selected.id);
              setKey((k) => k + 1);
            }}
          >
            ▶ 操作呢個畫面
          </button>
          <button onClick={() => focus(selected.id)}>
            放大至畫面 <kbd>2</kbd>
          </button>
          <h3>實際 UI 來源</h3>
          <p className="source-file">{sourceFor(selected)}</p>
          {selected.experimental && (
            <p className="experimental">
              呢個係模擬合資格 UI，唔代表正式 AI 已啟用。
            </p>
          )}
          <h3>流程連接</h3>
          {linked.length ? (
            linked.map((f, i) => (
              <button
                className="flow-link"
                key={i}
                onClick={() => focus(f.from === selected.id ? f.to : f.from)}
              >
                <small>
                  {f.from === selected.id ? "下一步" : "上一步"} · {f.label}
                </small>
                <span>
                  {
                    catalog.find(
                      (s) => s.id === (f.from === selected.id ? f.to : f.from),
                    )?.title
                  }{" "}
                  ↗
                </span>
              </button>
            ))
          ) : (
            <p>可直接操作頁面嘅原有控制項。</p>
          )}
        </aside>
      )}
      {play && (
        <div
          className="prototype-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="操作 App 預覽"
        >
          <div className="prototype-toolbar">
            <div>
              <strong>{catalog.find((s) => s.id === play)?.title}</strong>
              <span>真實 UI · 虛構資料 · 可以操作</span>
            </div>
            <div>
              <button onClick={() => setKey((k) => k + 1)}>重設</button>
              <button className="present" onClick={() => setPlay(null)}>
                返回畫布 <kbd>Esc</kbd>
              </button>
            </div>
          </div>
          <div className="prototype-body">
            <iframe
              key={`${play}-${key}-${manifest.updatedAt}`}
              title={`${project.title} 互動預覽`}
              src={
                manifest.screens?.[play]?.url ||
                `/frame?id=${encodeURIComponent(play)}`
              }
              style={{
                width:
                  catalog.find((s) => s.id === play)?.viewport?.width || 390,
              }}
              sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"
            />
            <aside>
              <h3>直接試用</h3>
              <p>畫面內嘅按鈕、表單、頁籤及保存流程都可以操作。</p>
              <h3>切換狀態</h3>
              <select
                aria-label="預覽狀態"
                value={play}
                onChange={(e) => {
                  setPlay(e.target.value);
                  setKey((k) => k + 1);
                }}
              >
                {groups.map((g) => (
                  <optgroup label={g.title} key={g.id}>
                    {catalog
                      .filter((s) => s.group === g.id)
                      .map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.title}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <h3>流程</h3>
              {flows
                .filter((f) => f.from === play || f.to === play)
                .map((f, i) => (
                  <button
                    className="flow-link"
                    key={i}
                    onClick={() => {
                      setPlay(f.from === play ? f.to : f.from);
                      setKey((k) => k + 1);
                    }}
                  >
                    <small>{f.label}</small>
                    <span>
                      {
                        catalog.find(
                          (s) => s.id === (f.from === play ? f.to : f.from),
                        )?.title
                      }{" "}
                      ↗
                    </span>
                  </button>
                ))}
              <p className="prototype-note">
                關閉或重設後，呢個預覽嘅改動會清除。正式帳戶資料唔會受影響。
              </p>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <ReactFlowProvider>
    <Canvas />
  </ReactFlowProvider>,
);
