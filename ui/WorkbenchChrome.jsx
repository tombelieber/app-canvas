import { useI18n, LanguagePicker } from "./i18n.jsx";
import React from "react";
import { outcomes } from "../lib/coverage.mjs";

export function WorkspaceDock({ analytics, preferences, menu, setMenu, drawer, setDrawer, active, browse, interact, retained, release, catalog, notice, limit, brand, view, setView, fit, rightOpen, toggleRight, startDemo, demoReady, hasJourneys }) {
  const { t } = useI18n();
  const { panels } = preferences;
  return <div className="workspace-dock">
    <button aria-label={t("Panels")} aria-expanded={menu} onClick={() => setMenu(!menu)}>{t("☷ Panels")}</button>
    {panels.top && <><button className="navigation-toggle" aria-label={t("Toggle navigation")} title={t("Show/hide navigation")} aria-pressed={panels.left} onClick={() => preferences.toggle("left")}>◧</button>{brand}<div className="canvas-view-controls" role="group" aria-label={t("Canvas view")}>{[["overview", t("Overview")], ["machine", t("State graph")]].map(([id, title]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{title}</button>)}</div><button className="fit-button" aria-label={t("Fit all")} onClick={fit}>{t("Fit all")}</button></>}
    <button className="present demo-start" aria-label={t("Start Demo")} title={hasJourneys ? t("Present the selected flow, page or all demos") : t("No playable flows yet")} disabled={!demoReady} onClick={startDemo}>▶ Demo</button>
    <button className="playback-toggle" aria-label={t("Open flow controls")} title={t("Play flow")} aria-expanded={rightOpen} onClick={toggleRight}>▷ <span>{t("Flows")}</span></button>
    {panels.left && <button aria-label={t("Navigation")} aria-expanded={drawer} className="drawer-toggle" onClick={() => setDrawer(!drawer)}>{t("Pages")}</button>}
    <LanguagePicker /><div className="mode-switch" role="group" aria-label={t("Interaction mode")}>
      <button aria-pressed={!active} onClick={browse}>{t("Browse")}</button><button aria-pressed={!!active} onClick={interact}>{t("Interact")}</button>
    </div>
    {panels.top && <button className="present operate-app" onClick={interact}>{t("▶ Use app")}</button>}
    {menu && <div className="panel-menu" role="region" aria-label={t("Workspace settings")}>
      <strong>{t("Show panels")}</strong>
      <label><input type="checkbox" checked={analytics.config?.enabled || false} disabled={!analytics.config?.configurable || analytics.config?.pending} onChange={e => analytics.toggle(e.target.checked)} />{t("Anonymous usage analytics")}</label>
      <p>{analytics.config?.error && <span role="alert">{t("Preference could not be saved. Analytics remains disabled.")}</span>}{t("No preview contents, source code, names or file paths are sent.")} <a href="https://tombelieber.github.io/app-canvas/about/#privacy">{t("Privacy and telemetry")}</a></p>
      {[["top", t("Top toolbar")], ["left", t("Left navigation")], ["right", t("Right details")]].map(([key, title]) => <label key={key}><input type="checkbox" checked={key === "right" ? rightOpen : panels[key]} onChange={() => key === "right" ? toggleRight() : preferences.toggle(key)} />{title}</label>)}
      <button onClick={fit}>{t("Fit screens")}</button>
      <button onClick={() => { preferences.restore(); setMenu(false); }}>{t("Restore layout")}</button>
      <p>{t("You can retain up to {0} app previews.", limit - 1)}</p>
      {!!retained.length && <><strong>{t("Retained app screens")}</strong>{retained.map(id => <button className="release-preview" key={id} onClick={() => release(id)}>{t("Release ·")} {catalog.find(s => s.id === id)?.title}</button>)}</>}
    </div>}
    {notice && <p role="alert" className="pool-notice">{t(notice)}</p>}
  </div>;
}

export function ScopeToolbar({ pages, page, setPage, query, search, depth, setDepth }) {
  const { t } = useI18n();
  return <div className="scope-toolbar">
    <input aria-label={t("Search screens")} placeholder={t("Search pages and states…")} value={query} onChange={e => search(e.target.value)} />
    <div className="scope-selects"><select aria-label={t("Page scope")} value={page} onChange={e => setPage(e.target.value)}><option value="all">{t("All pages")}</option>{pages.map(p => <option key={p.id} value={p.id}>{p.title}{p.route ? ` · ${p.route}` : ""}</option>)}</select>
    <select aria-label={t("Expansion depth")} value={depth} onChange={e => setDepth(e.target.value)}><option value="0">{t("Pages")}</option><option value="1">{t("Pages + features")}</option><option value="all">{t("All states")}</option></select></div>
  </div>;
}

export function PageNavigator({ pages, catalog, page, query, selectPage, selectedId, goTo, lines, setLines, links, children, close }) {
  const { t } = useI18n();
  return <aside className="layers-panel" aria-label={t("Page navigation")}>
    <div className="layers-heading">{t("Screens and states")}<span>{catalog.length}</span><button className="close" aria-label={t("Collapse navigation")} onClick={close}>‹</button></div>
    {children}
    <button className={`group-choice ${page === "all" ? "active" : ""}`} onClick={() => selectPage("all")}><span>▦</span>{t("All screens")}<small>{catalog.length}</small></button>
    <div className="layer-groups">{pages.map(p => {
      const states = catalog.filter(s => s.pageId === p.id), matches = states.filter(s => !query || `${s.title} ${s.id} ${s.feature}`.toLowerCase().includes(query.toLowerCase()));
      return <section key={p.id}><button className={`group-choice ${page === p.id ? "active" : ""}`} onClick={() => selectPage(p.id)}>{p.title}<small>{states.length}</small></button>
        {p.route && <small className="route-path">{p.route}</small>}
        {(page === p.id || query) && [...new Set(matches.map(s => s.feature))].map(feature => <div key={feature}><div className="feature-heading">{feature}</div>{matches.filter(s => s.feature === feature).map(s => <button key={s.id} title={s.id} className={`layer-screen ${selectedId === s.id ? "active" : ""}`} onClick={() => goTo(s.id)}>{s.title}</button>)}</div>)}
      </section>;
    })}</div>
    <div className="layers-foot"><label>{t("Connections")}<select aria-label={t("Flow connections")} value={lines} onChange={e => setLines(e.target.value)}><option value="related">{t("Related flows")}</option><option value="all">{t("All connections")}</option><option value="none">{t("Hide connections")}</option></select></label>
      {links?.repository && <p><a href={links.repository} target="_blank" rel="noreferrer">GitHub ↗</a> · <a href={links.agentGuide} target="_blank" rel="noreferrer">Agent guide ↗</a></p>}
    </div>
  </aside>;
}

export function Inspector({ selected, page, player, active, journeys, chooseJourney, interact, browse, navigate, reset, linked, catalog, goTo, close, retained, release }) {
  const { t } = useI18n();
  return <section className="inspector" aria-label={t("Screen details")}>
    <button className="close" aria-label={t("Close details")} onClick={close}>×</button>
    <span className="inspector-kicker">{page?.title} / {selected.feature}</span><h2>{selected.title}</h2><code>{selected.id}</code>
    {selected.outcome && <span className="state-badge" data-outcome={selected.outcome}>{t(outcomes[selected.outcome])}</span>}
    {selected.condition && <p className="entry-condition">{t("Condition:")} {selected.condition}</p>}
    <div className="inspector-actions"><button className="present" onClick={() => active ? browse() : interact(selected.id)}>{active ? t("Stop interacting · keep screen") : t("▶ Interact with screen")}</button>
      <button onClick={() => navigate(selected.id, !!active)}>{t("Zoom to screen")}<kbd>2</kbd></button></div>
    {journeys.find(j => j.kind === "case" && j.entry === selected.id) && <button onClick={() => chooseJourney(journeys.find(j => j.kind === "case" && j.entry === selected.id).id, true)}>{t("▶ Play this case")}</button>}
    <h3>{t("Flow links")}</h3>{linked.length ? linked.map((f, i) => {
      const target = catalog.find(s => s.id === (f.from === selected.id ? f.to : f.from));
      return <button className="flow-link" key={i} onClick={() => goTo(target.id, !!active)}><small>{f.from === selected.id ? t("Next") : t("Previous")} · {f.label}{target.pageId !== selected.pageId ? t("· Cross-page") : ""}</small><span>{target.title} ↗</span></button>;
    }) : <p>{t("No other flow links for this screen.")}</p>}
    <details className="inspector-details"><summary>{t("Source and preview settings")}</summary><p className="source-file">{selected.source || t("Application source")}</p>
      {selected.experimental && <p className="experimental">{t("Simulated qualified UI; production AI is not enabled.")}</p>}
      <button onClick={reset}>{t("Reset")}</button>{retained && <button onClick={() => release(selected.id)}>{t("Release preview")}</button>}
      <p className="prototype-note">{t("Interactions affect disposable synthetic previews only. Interacted screens stay open; release or reset clears that preview's edits.")}</p>
    </details>
  </section>;
}
