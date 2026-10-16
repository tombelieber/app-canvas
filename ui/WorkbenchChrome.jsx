import React from "react";
import { outcomes } from "../lib/coverage.mjs";

export function WorkspaceDock({ preferences, menu, setMenu, drawer, setDrawer, active, browse, interact, retained, release, catalog, notice, limit, brand, view, setView, fit, rightOpen, toggleRight }) {
  const { panels } = preferences;
  return <div className="workspace-dock">
    <button aria-label="面板" aria-expanded={menu} onClick={() => setMenu(!menu)}>☷ 面板</button>
    {panels.top && <><button aria-label="切換左側導航" title="顯示／收起左側導航" aria-pressed={panels.left} onClick={() => preferences.toggle("left")}>◧</button>{brand}<div className="canvas-view-controls" role="group" aria-label="畫布檢視">{[["overview", "畫面總覽"], ["machine", "狀態圖"]].map(([id, title]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{title}</button>)}</div><button className="fit-button" aria-label="全覽" onClick={fit}>全覽</button></>}
    <button className="playback-toggle" aria-label="開啟流程控制" title="播放流程" aria-expanded={rightOpen} onClick={toggleRight}>▷ <span>流程</span></button>
    {panels.left && <button aria-label="導航" aria-expanded={drawer} className="drawer-toggle" onClick={() => setDrawer(!drawer)}>頁面</button>}
    <div className="mode-switch" role="group" aria-label="操作模式">
      <button aria-pressed={!active} onClick={browse}>Browse</button><button aria-pressed={!!active} onClick={interact}>Interact</button>
    </div>
    {panels.top && <button className="present operate-app" onClick={interact}>▶ 操作 App</button>}
    {menu && <div className="panel-menu" role="region" aria-label="版面設定">
      <strong>面板顯示</strong>
      {[["top", "頂部工具列"], ["left", "左側導航"], ["right", "右側資料"]].map(([key, title]) => <label key={key}><input type="checkbox" checked={key === "right" ? rightOpen : panels[key]} onChange={() => key === "right" ? toggleRight() : preferences.toggle(key)} />{title}</label>)}
      <button onClick={fit}>全覽畫面</button>
      <button onClick={() => { preferences.restore(); setMenu(false); }}>還原版面</button>
      <p>操作過嘅畫面會保留；可同時保留 {limit - 1} 個。</p>
      {!!retained.length && <><strong>保留嘅操作畫面</strong>{retained.map(id => <button className="release-preview" key={id} onClick={() => release(id)}>釋放 · {catalog.find(s => s.id === id)?.title}</button>)}</>}
    </div>}
    {notice && <p role="alert" className="pool-notice">{notice}</p>}
  </div>;
}

export function ScopeToolbar({ pages, page, setPage, query, search, depth, setDepth }) {
  return <div className="scope-toolbar">
    <input aria-label="搜尋畫面" placeholder="搜尋頁面狀態…" value={query} onChange={e => search(e.target.value)} />
    <div className="scope-selects"><select aria-label="頁面範圍" value={page} onChange={e => setPage(e.target.value)}><option value="all">全部頁面</option>{pages.map(p => <option key={p.id} value={p.id}>{p.title}{p.route ? ` · ${p.route}` : ""}</option>)}</select>
    <select aria-label="展開深度" value={depth} onChange={e => setDepth(e.target.value)}><option value="0">頁面</option><option value="1">頁面＋功能</option><option value="all">全部狀態</option></select></div>
  </div>;
}

export function PageNavigator({ pages, catalog, page, query, selectPage, selectedId, goTo, lines, setLines, links, children, close }) {
  return <aside className="layers-panel" aria-label="頁面導航">
    <div className="layers-heading">畫面與狀態 <span>{catalog.length}</span><button className="close" aria-label="收起左側導航" onClick={close}>‹</button></div>
    {children}
    <button className={`group-choice ${page === "all" ? "active" : ""}`} onClick={() => selectPage("all")}><span>▦</span>全部畫面 <small>{catalog.length}</small></button>
    <div className="layer-groups">{pages.map(p => {
      const states = catalog.filter(s => s.pageId === p.id), matches = states.filter(s => !query || `${s.title} ${s.id} ${s.feature}`.toLowerCase().includes(query.toLowerCase()));
      return <section key={p.id}><button className={`group-choice ${page === p.id ? "active" : ""}`} onClick={() => selectPage(p.id)}>{p.title}<small>{states.length}</small></button>
        {p.route && <small className="route-path">{p.route}</small>}
        {(page === p.id || query) && [...new Set(matches.map(s => s.feature))].map(feature => <div key={feature}><div className="feature-heading">{feature}</div>{matches.filter(s => s.feature === feature).map(s => <button key={s.id} title={s.id} className={`layer-screen ${selectedId === s.id ? "active" : ""}`} onClick={() => goTo(s.id)}>{s.title}</button>)}</div>)}
      </section>;
    })}</div>
    <div className="layers-foot"><label>連線<select aria-label="流程連線範圍" value={lines} onChange={e => setLines(e.target.value)}><option value="related">相關流程</option><option value="all">全部連線</option><option value="none">隱藏連線</option></select></label>
      {links?.repository && <p><a href={links.repository} target="_blank" rel="noreferrer">GitHub ↗</a> · <a href={links.agentGuide} target="_blank" rel="noreferrer">Agent guide ↗</a></p>}
    </div>
  </aside>;
}

export function Inspector({ selected, page, player, active, journeys, chooseJourney, interact, browse, navigate, reset, linked, catalog, goTo, close, retained, release }) {
  return <section className="inspector" aria-label="畫面資料">
    <button className="close" aria-label="關閉畫面資料" onClick={close}>×</button>
    <span className="inspector-kicker">{page?.title} / {selected.feature}</span><h2>{selected.title}</h2><code>{selected.id}</code>
    {selected.outcome && <span className="state-badge" data-outcome={selected.outcome}>{outcomes[selected.outcome]}</span>}
    {selected.condition && <p className="entry-condition">觸發條件：{selected.condition}</p>}
    <div className="inspector-actions"><button className="present" onClick={() => active ? browse() : interact(selected.id)}>{active ? "停止操作 · 保留畫面" : "▶ 操作呢個畫面"}</button>
      <button onClick={() => navigate(selected.id, !!active)}>放大至畫面 <kbd>2</kbd></button></div>
    {journeys.find(j => j.kind === "case" && j.entry === selected.id) && <button onClick={() => chooseJourney(journeys.find(j => j.kind === "case" && j.entry === selected.id).id, true)}>▶ 播放此情境</button>}
    <h3>流程連接</h3>{linked.length ? linked.map((f, i) => {
      const target = catalog.find(s => s.id === (f.from === selected.id ? f.to : f.from));
      return <button className="flow-link" key={i} onClick={() => goTo(target.id, !!active)}><small>{f.from === selected.id ? "下一步" : "上一步"} · {f.label}{target.pageId !== selected.pageId ? " · 跨頁" : ""}</small><span>{target.title} ↗</span></button>;
    }) : <p>呢個畫面未有其他流程連接。</p>}
    <details className="inspector-details"><summary>來源與預覽設定</summary><p className="source-file">{selected.source || "Application source"}</p>
      {selected.experimental && <p className="experimental">模擬合資格 UI；唔代表正式 AI 已啟用。</p>}
      <button onClick={reset}>重設</button>{retained && <button onClick={() => release(selected.id)}>釋放此預覽</button>}
      <p className="prototype-note">操作只影響虛構預覽。操作過嘅畫面會保留；釋放或重設會清除該預覽嘅修改。</p>
    </details>
  </section>;
}
