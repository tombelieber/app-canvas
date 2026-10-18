import React, { useEffect, useState } from "react";
import { layerName } from "./draft.js";
export function ImportInspector({ node, screen, operation, duplicateScreen, upload, links, navigate, busy = false }) {
  const [value, setValue] = useState(""), [name, setName] = useState("");
  useEffect(() => { setValue(node?.text || ""); setName(node ? layerName(node) : ""); }, [node]);
  const style = node?.style || {}, disabled = !node || node.uneditable;
  const changeStyle = (property, next) => operation({ type: "setStyle", property, value: next });
  return <div className="import-inspector">
    <div className="import-section-title">{screen?.title || "Imported UI"}</div>
    {screen && <><p className="import-provenance">{screen.url}<br /><strong>{screen.quality}</strong> · observed scope</p>
      {screen.issues?.length > 0 && <details><summary>{screen.issues.length} capture limitations</summary><ul>{screen.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
      <button disabled={busy} onClick={duplicateScreen}>Duplicate screen</button><button disabled={busy} onClick={() => operation({ type: "resetScreen" })}>Reset screen</button></>}
    {node ? <><h3>{layerName(node)}</h3><code>{node.id}</code>{node.uneditable && <p>Read-only captured region</p>}
      <fieldset disabled={disabled || busy}><label>Layer name<input aria-label="Layer name" value={name} onChange={e => setName(e.target.value)} onBlur={() => { if (name !== layerName(node)) operation({ type: "rename", value: name }); }} /></label>
        {node.text !== undefined && <><label>Text content<textarea aria-label="Text content" value={value} onChange={e => setValue(e.target.value)} /></label><button onClick={() => operation({ type: "setText", value })}>Apply text</button></>}
        <div className="import-control-grid"><label>Font size<input aria-label="Font size" type="number" min="1" max="1000" value={parseFloat(style["font-size"]) || ""} placeholder="Inherited" onChange={e => { if (e.target.value) changeStyle("font-size", `${Number(e.target.value)}px`); }} /></label>
          <StyleField label="Font weight" value={style["font-weight"] || ""} apply={next => changeStyle("font-weight", next)} /></div>
        {[["Color", "color"], ["Fill", "background-color"], ["Border", "border"], ["Radius", "border-radius"], ["Opacity", "opacity"]].map(([label, property]) => <StyleField key={`${node.id}-${property}`} label={label} value={style[property] || ""} apply={next => changeStyle(property, next)} />)}
        <div className="import-control-grid">{["x", "y"].map(axis => <label key={axis}>{axis.toUpperCase()}<input aria-label={`Position ${axis.toUpperCase()}`} type="number" value={Math.round(node.offset?.[axis] || 0)} onChange={e => operation({ type: "move", x: node.offset?.x || 0, y: node.offset?.y || 0, [axis]: Number(e.target.value) })} /></label>)}</div>
        <div className="import-control-grid">{["width", "height"].map(axis => <label key={axis}>{axis}<input aria-label={`Layer ${axis}`} type="number" min="1" max="16000" value={Math.round(parseFloat(style[axis]) || node.rect?.[axis] || 1)} onChange={e => { if (Number(e.target.value) > 0) operation({ type: "resize", width: parseFloat(style.width) || node.rect?.width || 1, height: parseFloat(style.height) || node.rect?.height || 1, [axis]: Number(e.target.value) }); }} /></label>)}</div>
        {node.tag === "img" && <label>Replace image<input aria-label="Replace image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => { if (e.target.files[0]) upload(e.target.files[0]); e.target.value = ""; }} /></label>}
        <div className="import-button-grid"><button onClick={() => operation({ type: "duplicate", newId: `copy-${crypto.randomUUID()}` })}>Duplicate layer</button><button onClick={() => operation({ type: "setHidden", value: !node.hidden })}>{node.hidden ? "Show layer" : "Hide layer"}</button>
          <button onClick={() => operation({ type: "reorder", direction: "forward" })}>Bring forward</button><button onClick={() => operation({ type: "reorder", direction: "backward" })}>Send backward</button>
          <button onClick={() => operation({ type: "resetLayer" })}>Reset layer</button><button onClick={() => operation({ type: "delete" })}>Delete layer</button></div>
      </fieldset></> : <p>Select a layer in Edit mode or in the layer tree.</p>}
    <h3>Recorded flows</h3>{links.length ? links.map(link => <button className="flow-link" key={link.id} onClick={() => navigate(link.to)}><small>{link.kind === "reference" ? "Reference" : "Observed action"}</small><span>{link.label} →</span></button>) : <p>No observed transition from this state.</p>}
  </div>;
}
function StyleField({ label, value, apply }) {
  const [next, setNext] = useState(value); useEffect(() => setNext(value), [value]);
  return <label>{label}<input aria-label={label} value={next} onChange={e => setNext(e.target.value)} onBlur={() => { if (next && next !== value) apply(next); }} onKeyDown={e => { if (e.key === "Enter" && next) apply(next); }} /></label>;
}
