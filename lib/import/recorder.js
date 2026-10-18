export function installRecorder() {
  if (window.__appCanvasRecorder) return; window.__appCanvasRecorder = true;
  const emit = message => { try { window.__appCanvasRecord(JSON.stringify(message)); } catch { /* driver has detached */ } };
  const privatePage = () => /\/(auth|login|sign[-_]?in|sign[-_]?up|register|oauth|api[-_]?keys?|credentials|password)(\/|$)/i.test(location.pathname) || !!document.querySelector('input[type="password"],input[autocomplete="one-time-code"]');
  let armedUntil = 0;
  const action = event => {
    if (!event.isTrusted || privatePage()) return;
    const target = event.target.closest?.("button,a,input,select,textarea,[role=button],[role=menuitem],[role=option],[role=tab]") || event.target;
    if (target.matches?.('input[type="password"],input[type="email"],textarea,[autocomplete="one-time-code"]')) return;
    const label = target.getAttribute?.("aria-label") || target.getAttribute?.("title") || target.innerText?.trim() || target.getAttribute?.("placeholder") || target.localName;
    armedUntil = Date.now() + 10000;
    emit({ kind: "action", action: { id: `a-${crypto.randomUUID()}`, type: event.type === "change" ? "change" : "click", label: String(label).slice(0, 200) } });
  };
  document.addEventListener("click", action, true); document.addEventListener("change", action, true);
  let timer;
  new MutationObserver(() => { if (Date.now() > armedUntil) return; clearTimeout(timer); timer = setTimeout(() => emit({ kind: "mutation" }), 160); }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  document.addEventListener("keydown", event => {
    if (event.isTrusted && event.altKey && event.shiftKey && event.code === "KeyC" && !privatePage()) { event.preventDefault(); emit({ kind: "capture" }); }
  }, true);
}
