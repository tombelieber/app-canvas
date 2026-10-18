import { createHash } from "node:crypto";
export function toCanvasProject({ project, documents }, sessionToken) {
  const routes = [...new Set(project.screens.map(s => s.pageId))];
  const pageId = route => `page-${createHash("sha256").update(route).digest("hex").slice(0, 12)}`;
  const pages = routes.map(route => ({ id: pageId(route), route, title: route.split("/").filter(Boolean).at(-1)?.replace(/[-_]/g, " ") || "Home" }));
  return { kind: "web-import", title: project.title, sessionToken, groups: pages.length ? pages : [{ id: "import", title: "Captured pages" }], pages,
    catalog: project.screens.map(s => ({ id: s.id, title: s.title, pageId: pageId(s.pageId), group: pageId(s.pageId), feature: "Captured states", viewport: documents[s.id]?.viewport || project.viewport, source: s.url, quality: s.quality })),
    flows: project.flows, journeys: [] };
}
export function importManifest(current) {
  return { revision: current.project.revision, status: "ready", screens: Object.fromEntries(current.project.screens.map(s => [s.id, {
    width: current.documents[s.id].viewport.width, height: current.documents[s.id].height,
    domUrl: `/import/document/${s.id}`, sharedUrl: `/import/overview/${s.id}`,
  }])) };
}
