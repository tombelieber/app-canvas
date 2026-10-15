// Import in the isolated preview entry before importing application modules.
export function installPreview({ handleFetch, allowFetch = () => false } = {}) {
  const nativeFetch = globalThis.fetch.bind(globalThis),
    errors = [],
    requests = [];
  globalThis.__appCanvas = { errors, requests, synthetic: true };
  window.addEventListener("error", (event) => {
    errors.push(event.message);
    failed(event.error || event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    errors.push(String(event.reason));
    failed(event.reason);
  });
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      location.href,
    );
    const result = await handleFetch?.(url, options, input);
    if (result) return result;
    if (url.origin === location.origin && allowFetch(url))
      return nativeFetch(input, options);
    requests.push({ method: options.method || "GET", path: url.pathname });
    throw Error(
      `Unmocked preview request: ${options.method || "GET"} ${url.pathname}`,
    );
  };
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape")
      window.parent.postMessage({ type: "review-exit" }, "*");
  });
  return globalThis.__appCanvas;
}
export function ready() {
  document.documentElement.dataset.reviewReady = "true";
}
// Preserve the selected fixture when a real application uses full-document links.
// Initial entry/reset starts a fresh module graph; subsequent HTML navigation
// keeps its destination path and the same synthetic case.
export function readScenario(catalog, { key = "default" } = {}) {
  const initial = location.pathname === "/__app_canvas";
  const storageKey = `app-canvas:case:${key}`;
  const id = initial
    ? new URLSearchParams(location.search).get("id")
    : sessionStorage.getItem(storageKey);
  const selected = catalog.find((s) => s.id === id);
  if (!selected) throw Error(`Unknown preview state ${id}`);
  if (initial) sessionStorage.setItem(storageKey, id);
  return {
    ...selected,
    path: initial
      ? selected.path
      : `${location.pathname}${location.search}${location.hash}`,
  };
}
export function failed(error) {
  document.documentElement.dataset.reviewError = String(
    error?.message || error,
  );
  document.documentElement.dataset.reviewReady = "error";
}
export async function waitFor(selector, { timeout = 10000 } = {}) {
  const existing = document.querySelector(selector);
  if (existing) return existing;
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const node = document.querySelector(selector);
      if (node) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(node);
      }
    });
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(Error(`Screen did not render ${selector}`));
    }, timeout);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  });
}
