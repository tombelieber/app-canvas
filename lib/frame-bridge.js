import { isolateStorage } from "./frame-storage.js";
import { actionRunner } from "./frame-actions.js";
if (!window.__appCanvasBridge) {
  window.__appCanvasBridge = true;
  isolateStorage(window.name);
  const script = document.currentScript;
  const parentOrigin = script?.dataset.parentOrigin || new URL(script?.src || location.href).origin;
  let interactive = window === parent, scheduled = false, observer, resize;
  const runAction = actionRunner();
  const post = (payload) => {
    if (window !== parent) parent.postMessage({ channel: "app-canvas", ...payload }, parentOrigin);
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
    if (event.data.type === "interact") interactive = event.data.value === true;
    if (event.data.type === "inspect") report();
    if (event.data.type === "command") {
      runAction(event.data.action).then((result) => post({ type: "result", requestId: event.data.requestId, result }), (error) => post({ type: "result", requestId: event.data.requestId, error: error.message }));
    }
  }
  const onKey = (event) => { if (event.key === "Escape" && !document.querySelector("dialog[open]")) post({ type: "exit" }); };
  const onDownload = (event) => { if (!interactive && event.target.closest?.("a[download]")) event.preventDefault(); };
  const anchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(...args) { if (!interactive && this.hasAttribute("download")) return; return anchorClick.apply(this, args); };
  function attach() {
    window.removeEventListener("message", onMessage); window.addEventListener("message", onMessage);
    document.removeEventListener("keydown", onKey); document.addEventListener("keydown", onKey);
    document.removeEventListener("click", onDownload, true); document.addEventListener("click", onDownload, true);
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
  attach();
}
