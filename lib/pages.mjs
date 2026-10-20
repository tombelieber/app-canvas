// Page ownership is authored from the router; URL paths and graph hops are not
// interchangeable with a page -> feature -> state hierarchy.
export const UI_GROUP_THRESHOLD = 128;
export function initialUiDepth(catalog) {
  if (catalog.length <= UI_GROUP_THRESHOLD) return 'all';
  const features = new Set(catalog.map(row => row.pageId + ':' + row.feature));
  return features.size <= UI_GROUP_THRESHOLD ? '1' : '0';
}
export function pageModel(project) {
  const pages = project.pages || project.groups.map(g => ({ id: g.id, title: g.title || g.label || g.id }));
  const ids = new Set();
  for (const p of pages) {
    if (!/^[a-zA-Z0-9_-]+$/.test(p.id || "") || !p.title || ids.has(p.id)) throw Error(`Invalid or duplicate page ${p.id}`);
    ids.add(p.id);
  }
  const catalog = project.catalog.map(s => {
    const page = s.pageId || s.group;
    if (!ids.has(page)) throw Error(`Unknown page for ${s.id}: ${page}`);
    if (s.feature !== undefined && (typeof s.feature !== "string" || !s.feature.trim())) throw Error(`Invalid feature for ${s.id}`);
    return { ...s, pageId: page, feature: s.feature || "一般" };
  });
  return { pages, catalog };
}

export function scopedScreens(catalog, { page = "all", query = "", depth = "1", selected, journey } = {}) {
  const matching = catalog.filter(s => (page === "all" || s.pageId === page) && (!query || `${s.title} ${s.id} ${s.feature}`.toLowerCase().includes(query.toLowerCase())) && (!journey || journey.includes(s.id)));
  if (query || journey || depth === "all") return matching;
  const seen = new Set();
  return matching.filter(s => {
    const key = depth === "0" ? s.pageId : `${s.pageId}:${s.feature}`;
    const keep = !seen.has(key); seen.add(key);
    return keep || s.id === selected;
  });
}
