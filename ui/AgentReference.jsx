import React, { useEffect, useRef, useState } from "react";
import { agentReferencePrompt } from "../lib/agent-reference.mjs";
import "./AgentReference.css";

export function AgentReference({ project, screen, element, imported = false, layer, picking = false, canPick = false, onPick, analytics }) {
  const [instruction, setInstruction] = useState(""), [state, setState] = useState("idle");
  const attempt = useRef(0);
  const identity = `${screen?.id}:${element?.selector || ""}:${layer?.id || ""}`;
  useEffect(() => { attempt.current++; setState("idle"); }, [identity, instruction]);
  useEffect(() => () => { attempt.current++; }, []);
  const prompt = agentReferencePrompt({ project, screen, element, imported, layer, instruction });
  const copy = async () => {
    const current = ++attempt.current;
    setState("copying");
    try {
      if (!navigator.clipboard?.writeText) throw Error("clipboard_unavailable");
      await navigator.clipboard.writeText(prompt);
      analytics?.track("reference_copied");
      if (attempt.current === current) setState("copied");
    } catch {
      analytics?.track("reference_copy_failed", { error_code: "clipboard_unavailable" });
      if (attempt.current === current) setState("failed");
    }
  };
  return <section className="agent-reference" aria-label="Change with your agent">
    <h3>Change with your agent</h3>
    {!imported && onPick && <button type="button" disabled={!canPick && !picking} aria-pressed={picking} onClick={onPick}>{picking ? "Cancel pointing" : "Point to an element"}</button>}
    {picking && <p role="status">Click an element in the preview. Its normal action will not run. Press Escape to cancel.</p>}
    {element && <p className="agent-reference-target">Selected element: <code>{element.selector || element.tag}</code></p>}
    {imported && <p>References a captured local alternative. Your agent needs the matching source project to apply changes.</p>}
    <label>What should change?<textarea aria-label="What should change?" rows="3" maxLength={4000} value={instruction} onChange={event => setInstruction(event.target.value)} placeholder="Make this button easier to find." /></label>
    <button type="button" className="present" disabled={!prompt || state === "copying" || picking} onClick={copy}>{state === "copying" ? "Copying…" : "Copy change request"}</button>
    {state === "copied" && <p role="status">Copied. Paste into Claude Code, Codex, or your coding agent.</p>}
    {state === "failed" && <p role="alert">Clipboard unavailable. Select and copy the request below.</p>}
    {prompt && <details open={state === "failed"}><summary>Review or copy the request</summary><textarea aria-label="Agent change request" rows="8" readOnly value={prompt} onFocus={event => event.target.select()} /></details>}
    <p className="agent-reference-note">Only copied when you ask. Agent Canvas does not send this request to an AI service.</p>
  </section>;
}
