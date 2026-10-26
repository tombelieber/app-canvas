import React, { useEffect, useRef, useState } from "react";
import { agentReferencePrompt } from "../lib/agent-reference.mjs";
import "./AgentReference.css";
import { useI18n } from "./i18n.jsx";

export function AgentReference({ project, screen, element, imported = false, layer, picking = false, canPick = false, onPick, analytics }) {
  const { t } = useI18n();
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
  return <section className="agent-reference" aria-label={t("Change with your agent")}>
    <h3>{t("Change with your agent")}</h3>
    {!imported && onPick && <button type="button" disabled={!canPick && !picking} aria-pressed={picking} onClick={onPick}>{picking ? t("Cancel pointing") : t("Point to an element")}</button>}
    {picking && <p role="status">{t("Click an element in the preview. Its normal action will not run. Press Escape to cancel.")}</p>}
    {element && <p className="agent-reference-target">{t("Selected element:")} <code>{element.selector || element.tag}</code></p>}
    {imported && <p>{t("References a captured local alternative. Your agent needs the matching source project to apply changes.")}</p>}
    <label>{t("What should change?")}<textarea aria-label={t("What should change?")} rows="3" maxLength={4000} value={instruction} onChange={event => setInstruction(event.target.value)} placeholder={t("Make this button easier to find.")} /></label>
    <button type="button" className="present" disabled={!prompt || state === "copying" || picking} onClick={copy}>{state === "copying" ? t("Copying…") : t("Copy change request")}</button>
    {state === "copied" && <p role="status">{t("Copied. Paste into Claude Code, Codex, or your coding agent.")}</p>}
    {state === "failed" && <p role="alert">{t("Clipboard unavailable. Select and copy the request below.")}</p>}
    {prompt && <details open={state === "failed"}><summary>{t("Review or copy the request")}</summary><textarea aria-label={t("Agent change request")} rows="8" readOnly value={prompt} onFocus={event => event.target.select()} /></details>}
    <p className="agent-reference-note">{t("Only copied when you ask. Agent Canvas does not send this request to an AI service.")}</p>
  </section>;
}
