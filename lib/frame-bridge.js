import { isolateStorage } from "./frame-storage.js";
import { actionRunner } from "./frame-actions.js";
import { describeElement } from "./agent-reference.mjs";
if (!window.__appCanvasBridge) {
  window.__appCanvasBridge = true;
  isolateStorage(window.name);
  const script = document.currentScript;
  const parentOrigin = script?.dataset.parentOrigin || new URL(script?.src || location.href).origin;
  const documentId = crypto.randomUUID();
  let interactive = window === parent, presentation = false, scheduled = false, observer, resize;
  let picking = false, pickOutline, swallowGesture = false;
  const runAction = actionRunner();
  const post = (payload) => {
    if (window !== parent) parent.postMessage({ channel: "app-canvas", documentId, ...payload }, parentOrigin);
  };
  function report() {
    scheduled = false;
    if (!document.documentElement) return;
    const height = document.documentElement.scrollHeight + Math.max(0, ...[...document.querySelectorAll("main,[role=main],[data-canvas-scroll]")].filter((el) => el.clientHeight > 0).map((el) => el.scrollHeight - el.clientHeight));
    const errors = window.__appCanvas?.errors || window.__review?.errors || [];
    post({ type: "state", ready: document.documentElement.dataset.reviewReady === "true", error: document.documentElement.dataset.reviewError || (errors.length ? "Preview runtime error" : window.__appCanvas?.requests?.length ? "Unmocked preview request" : ""), height: Math.min(16000, Math.max(200, height)) });
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(report); } }
  function onMessage(event) {
    if (event.source !== parent || event.origin !== parentOrigin || event.data?.channel !== "app-canvas") return;
    if (event.data.type === "interact") { interactive = event.data.value === true; presentation = event.data.presentation === true; }
    if (event.data.type === "inspect") report();
    if (event.data.type === "pick") setPicking(event.data.value === true);
    if (event.data.type === "command") {
      runAction(event.data.action).then((result) => post({ type: "result", requestId: event.data.requestId, result }), (error) => post({ type: "result", requestId: event.data.requestId, error: error.message }));
    }
  }
  const onKey = (event) => {
    if (picking) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === "Escape") { setPicking(false); post({ type: "exit" }); }
      return;
    }
    if (event.key === "Escape" && (presentation || !document.querySelector("dialog[open]"))) {
      if (presentation) { event.preventDefault(); event.stopImmediatePropagation(); }
      post({ type: "exit" });
    }
  };
  const onDownload = (event) => { if (!interactive && event.target.closest?.("a[download]")) event.preventDefault(); };
  function setPicking(value) {
    picking = value;
    document.documentElement?.toggleAttribute("data-agent-canvas-picking", value);
    if (!value) { pickOutline?.remove(); pickOutline = undefined; }
  }
  const onPoint = event => {
    if (!picking) {
      if (!swallowGesture) return;
      if (event.type === "pointerdown") { swallowGesture = false; return; }
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === "click") swallowGesture = false;
      return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.type === "click" || event.type === "touchend" || event.type === "pointerup" && event.pointerType === "touch") {
      const element = describeElement(event.target);
      setPicking(false);
      // Canceling touchstart may suppress the compatibility click entirely.
      // Select on pointerup and swallow the remainder of that same gesture.
      if (event.type !== "click") swallowGesture = true;
      if (element) post({ type: "picked", element });
    }
  };
  const onHover = event => {
    if (!picking || !event.target?.getBoundingClientRect) return;
    if (!pickOutline) {
      pickOutline = document.createElement("div");
      pickOutline.setAttribute("aria-hidden", "true");
      Object.assign(pickOutline.style, { position: "fixed", pointerEvents: "none", border: "2px solid #287b83", background: "rgba(40,123,131,.08)", zIndex: "2147483647", boxSizing: "border-box" });
      document.body.append(pickOutline);
    }
    const rect = event.target.getBoundingClientRect();
    Object.assign(pickOutline.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  };
  const anchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(...args) { if (!interactive && this.hasAttribute("download")) return; return anchorClick.apply(this, args); };
  function attach() {
    window.removeEventListener("message", onMessage); window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey, true);
    document.removeEventListener("click", onDownload, true); document.addEventListener("click", onDownload, true);
    for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "click", "dblclick", "contextmenu", "submit"]) {
      // The bridge is injected before application scripts. Window capture runs
      // before application window/document listeners and cancels their action.
      // Do not remove/re-add on DOMContentLoaded: doing so would move these
      // listeners behind application handlers registered while parsing.
      window.addEventListener(type, onPoint, { capture: true, passive: false });
    }
    document.removeEventListener("pointermove", onHover, true); document.addEventListener("pointermove", onHover, true);
    observer?.disconnect(); resize?.disconnect();
    resize = new ResizeObserver(schedule);
    if (document.documentElement) resize.observe(document.documentElement);
    observer = new MutationObserver(schedule); observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-review-ready", "data-review-error", "hidden", "open"] });
    schedule();
  }
  const focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function(options) { return focus.call(this, interactive ? options : { ...options, preventScroll: true }); };
  const close = document.close.bind(document);
  document.close = (...args) => { const result = close(...args); attach(); return result; };
  document.addEventListener("DOMContentLoaded", attach, { once: true });
  window.addEventListener("load", schedule);
  window.addEventListener("pagehide", () => post({ type: "navigating" }));
  window.addEventListener("pageshow", schedule);
  attach();
}
