import { useCallback, useEffect, useMemo, useRef, useState } from "react";
export function useBridge(onExit) {
  const registry = useRef(new Map()), pending = useRef(new Map()), waiting = useRef(new Map()), exit = useRef(onExit);
  exit.current = onExit;
  const [states, setStates] = useState({});
  useEffect(() => {
    const receive = (event) => {
      if (event.data?.channel !== "app-canvas") return;
      const entry = [...registry.current.entries()].find(([, frame]) => frame.element.contentWindow === event.source && frame.origin === event.origin);
      if (!entry) return;
      const [id] = entry;
      if (event.data.type === "navigating" && event.data.documentId === entry[1].documentId) {
        entry[1].navigating = true; entry[1].ready = false;
      }
      if (event.data.type === "state") {
        const documentId = event.data.documentId || entry[1].documentId || entry[1].epoch;
        if (entry[1].navigating && documentId === entry[1].documentId) return;
        entry[1].documentId = documentId; entry[1].navigating = false;
        entry[1].ready = event.data.ready === true && !event.data.error;
        if (entry[1].ready) {
          const keep = [];
          for (const waiter of waiting.current.get(id) || []) if (!waiter.epoch || waiter.epoch === entry[1].epoch) { clearTimeout(waiter.timer); waiter.resolve(); } else keep.push(waiter);
          waiting.current.set(id, keep);
          // A full-document navigation may replace an outstanding assertion's
          // document. Recheck it in the new ready DOM within its original
          // timeout; never repeat a click, submission or other mutation.
          for (const [requestId, request] of pending.current) {
            if (request.id !== id || request.sentTo === documentId) continue;
            if (request.sentTo && request.action.type !== "expect") {
              clearTimeout(request.timer); pending.current.delete(requestId);
              request.reject(Error(`Preview navigated before confirming: ${request.action.selector || request.action.type}`));
            } else {
              request.sentTo = documentId;
              send(id, { type: "command", action: request.action, requestId });
            }
          }
        }
        setStates((old) => {
        const next = { ready: event.data.ready === true, error: String(event.data.error || ""), height: Number(event.data.height) };
        return JSON.stringify(old[id]) === JSON.stringify(next) ? old : { ...old, [id]: next };
        });
      }
      if (event.data.type === "exit") exit.current(id);
      if (event.data.type === "result") {
        const request = pending.current.get(event.data.requestId);
        if (request?.id !== id) return;
        if (event.data.documentId && event.data.documentId !== request.sentTo) return;
        clearTimeout(request.timer); pending.current.delete(event.data.requestId);
        event.data.error ? request.reject(Error(event.data.error)) : request.resolve(event.data.result);
      }
    };
    window.addEventListener("message", receive);
    return () => { window.removeEventListener("message", receive); for (const request of pending.current.values()) { clearTimeout(request.timer); request.reject(Error("Preview closed")); } for (const waiters of waiting.current.values()) for (const waiter of waiters) { clearTimeout(waiter.timer); waiter.reject(Error("Preview closed")); } };
  }, []);
  const register = useCallback((id, element, url) => {
    if (element) registry.current.set(id, { element, origin: new URL(url, location.href).origin, epoch: new URL(url, location.href).searchParams.get("__canvas_epoch") });
    else { registry.current.delete(id); setStates(old => { const next = { ...old }; delete next[id]; return next; }); }
  }, []);
  const send = useCallback((id, message) => {
    const frame = registry.current.get(id);
    frame?.element.contentWindow?.postMessage({ channel: "app-canvas", ...message }, frame.origin);
  }, []);
  const command = useCallback((id, action) => new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => { pending.current.delete(requestId); reject(Error(`Preview step timed out: ${action.selector || action.type}`)); }, (action.timeout || 8000) + 3000);
    const frame = registry.current.get(id), request = { id, action, resolve, reject, timer, sentTo: null };
    pending.current.set(requestId, request);
    if (frame?.ready) {
      request.sentTo = frame.documentId || frame.epoch;
      send(id, { type: "command", action, requestId });
    }
  }), [send]);
  const whenReady = useCallback((id, epoch) => new Promise((resolve, reject) => {
    const frame = registry.current.get(id);
    if (frame?.ready && (!epoch || frame.epoch === epoch)) return resolve();
    const timer = setTimeout(() => { waiting.current.delete(id); reject(Error("Live preview did not become ready")); }, 20000);
    const waiters = waiting.current.get(id) || []; waiters.push({ resolve, reject, timer, epoch }); waiting.current.set(id, waiters);
  }), []);
  const cancel = useCallback((id) => {
    for (const [key, request] of pending.current) if (request.id === id) { clearTimeout(request.timer); request.reject(Error("Journey stopped")); pending.current.delete(key); }
    for (const waiter of waiting.current.get(id) || []) { clearTimeout(waiter.timer); waiter.reject(Error("Journey stopped")); }
    waiting.current.delete(id);
  }, []);
  return useMemo(() => ({ states, registry, register, send, command, whenReady, cancel }), [states, register, send, command, whenReady, cancel]);
}
