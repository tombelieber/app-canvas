import { useEffect, useState } from "react";
const defaults = { top: true, left: true, right: true };
export function usePanelPreferences(key) {
  const [panels, setPanels] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(key)); return Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, typeof saved?.[k] === "boolean" ? saved[k] : v])); }
    catch { return defaults; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(panels)); } catch { /* Private browsing/storage denial must not stop the canvas. */ } }, [key, panels]);
  return { panels, toggle: key => setPanels(old => ({ ...old, [key]: !old[key] })), restore: () => setPanels({ ...defaults }) };
}
