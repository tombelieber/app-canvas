import { useEffect, useRef, useState } from "react";
import { pageModel } from "../lib/pages.mjs";
const resource = (name) => new URL(`../${name}`, import.meta.url);
const sourceProject = await (await fetch(resource("project.json"), { cache: "no-store" })).json();
// A static host/browser can briefly retain the previous project.json after a
// deployment. Normalize that valid public contract before rendering new chrome.
export const project = { ...sourceProject, ...pageModel(sourceProject) };
export function useManifest() {
  const [manifest, setManifest] = useState({ status: "building", screens: {} }), loaded = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const update = (next) => {
      if (cancelled) return;
      if (loaded.current && next.canvasHash && loaded.current !== next.canvasHash) { location.reload(); return; }
      loaded.current = next.canvasHash || loaded.current; setManifest(next);
    };
    if (project.static) {
      fetch(resource("manifest.json"), { cache: "no-store" }).then((r) => r.json()).then(update).catch((error) => update({ status: "error", screens: {}, error: error.message }));
      return () => { cancelled = true; };
    }
    const events = new EventSource(resource("events")); events.onmessage = (event) => update(JSON.parse(event.data));
    return () => { cancelled = true; events.close(); };
  }, []);
  return manifest;
}
