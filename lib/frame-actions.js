// The browser player and CLI verification execute these same authored steps.
// No eval, live provider calls or arbitrary filesystem access.
export function actionRunner() {
  const nativeFetch = window.fetch.bind(window), faults = [];
  let fixtureFetch;
  const find = (action) => [...document.querySelectorAll(action.selector)].find((el) => action.type === "expect" || !action.text || el.textContent.includes(action.text));
  const visible = (el) => !!el?.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
  const wait = (action, condition) => new Promise((resolve, reject) => {
    let observer, timer;
    const inspect = () => {
      const el = find(action);
      if (condition(el)) { observer?.disconnect(); clearTimeout(timer); resolve(el); return true; }
    };
    if (inspect()) return;
    observer = new MutationObserver(inspect); observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    timer = setTimeout(() => { observer.disconnect(); reject(Error(`Expected ${action.selector}${action.text ? ` containing ${action.text}` : ""}`)); }, action.timeout || 8000);
  });
  return async (action) => {
    if (action.type === "fault") {
      if (!window.__appCanvas?.synthetic && !window.__review?.synthetic) throw Error("Fault injection requires an explicit synthetic fixture");
      if (!/^\/api\//.test(action.path) || !Number.isInteger(action.count ?? 1) || (action.count ?? 1) > 10) throw Error("Invalid fixture fault");
      if (!fixtureFetch) {
        fixtureFetch = window.fetch.bind(window);
        window.fetch = async (input, options = {}) => {
          const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
          const method = (options.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
          const fault = faults.find((f) => f.remaining > 0 && f.method === method && f.pattern.test(url.pathname));
          if (fault) {
            fault.remaining--;
            if (fault.network) throw TypeError("Synthetic offline request");
            return new Response(JSON.stringify({ error: fault.error || "provider_unavailable" }), { status: fault.status || 503, headers: { "Content-Type": "application/json" } });
          }
          return fixtureFetch(input, options);
        };
      }
      const escaped = action.path.split("/").map((part) => part.startsWith(":") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("/");
      faults.push({ ...action, remaining: action.count ?? 1, pattern: new RegExp(`^${escaped}$`) });
      return { installed: true };
    }
    if (action.type === "expect") {
      await wait(action, (el) => !!el && (action.hidden ? !visible(el) : visible(el)) && (action.text === undefined || el.textContent.includes(action.text)) && (action.value === undefined || el.value === action.value) && (action.checked === undefined || el.checked === action.checked));
      return { matched: true, count: document.querySelectorAll(action.selector).length };
    }
    const el = await wait(action, (el) => visible(el) && !el.disabled);
    el.focus({ preventScroll: true });
    el.animate?.([{ outline: "4px solid #e1a329" }, { outline: "0px solid transparent" }], { duration: 700 });
    if (action.type === "click") el.click();
    else if (action.type === "check") { if (el.checked !== (action.value !== false)) el.click(); }
    else if (action.type === "fill" || action.type === "select") {
      const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(el, action.value);
      el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (action.type === "file") {
      const previous = action.replaces ? document.querySelector(action.replaces) : null;
      const url = new URL(action.asset, location.href);
      if (!action.asset.startsWith("./") || action.asset.includes("..") || url.origin !== location.origin) throw Error("Only local synthetic file assets are supported");
      const response = await nativeFetch(url); if (!response.ok) throw Error("Synthetic file asset unavailable");
      const file = new File([await response.blob()], action.name || "synthetic-preview.png", { type: action.mime || "image/png" });
      const transfer = new DataTransfer(); transfer.items.add(file); el.files = transfer.files;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      if (action.replaces) await wait({ selector: action.replaces, timeout: action.timeout }, replacement => visible(replacement) && replacement !== previous);
    } else throw Error(`Unsupported action ${action.type}`);
    return { performed: action.type };
  };
}
