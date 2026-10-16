// A stable iframe name survives full-document navigation. Namespace both
// Storage APIs so sibling cases cannot overwrite each other's state.
export function isolateStorage(frameKey) {
  if (!frameKey || !frameKey.startsWith("app-canvas:")) return;
  const backing = window.sessionStorage, run = frameKey.split(":")[1];
  if (backing.getItem("app-canvas:active-run") !== run) {
    for (const key of Object.keys(backing)) if (key.startsWith("app-canvas:")) backing.removeItem(key);
    backing.setItem("app-canvas:active-run", run);
  }
  const epoch = new URL(location.href).searchParams.get("__canvas_epoch");
  const epochKey = `${frameKey}:epoch`;
  if (epoch !== null && backing.getItem(epochKey) !== epoch) {
    for (const key of Object.keys(backing)) if (key.startsWith(`${frameKey}:`)) backing.removeItem(key);
    backing.setItem(epochKey, epoch);
  }
  for (const name of ["localStorage", "sessionStorage"]) {
    const storage = backing, prefix = `${frameKey}:${name}:`;
    const keys = () => Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key) => key?.startsWith(prefix));
    const methods = {
      getItem: (key) => storage.getItem(prefix + key),
      setItem: (key, value) => storage.setItem(prefix + key, String(value)),
      removeItem: (key) => storage.removeItem(prefix + key),
      clear: () => keys().forEach((key) => storage.removeItem(key)),
      key: (index) => keys()[index]?.slice(prefix.length) ?? null,
    };
    Object.defineProperty(window, name, { configurable: true, value: new Proxy({}, {
      get: (_, key) => key === "length" ? keys().length : key in methods ? methods[key] : typeof key === "string" ? methods.getItem(key) ?? undefined : undefined,
      set: (_, key, value) => { methods.setItem(key, value); return true; },
      deleteProperty: (_, key) => { methods.removeItem(key); return true; },
      ownKeys: () => keys().map((key) => key.slice(prefix.length)),
      getOwnPropertyDescriptor: (_, key) => methods.getItem(key) === null ? undefined : { configurable: true, enumerable: true, writable: true, value: methods.getItem(key) },
    }) });
  }
}
