const nonempty = value => typeof value === "string" && value.trim().length > 0;

export function checkDiscoveryCoverage(discovery, inventory) {
  if (discovery.issues.length) throw Error(`Unresolved source discovery: ${discovery.issues.map(item => `${item.path}: ${item.reason}`).join("; ")}`);
  const actual = new Map(discovery.obligations.map(item => [item.id, item]));
  const recorded = new Set((inventory.obligations || []).map(item => item.id));
  if (recorded.size !== actual.size || [...actual.keys()].some(id => !recorded.has(id))) throw Error("Source discovery obligations changed; regenerate the worklist and inspect its pending items");
  const reviews = new Map(), items = new Map((inventory.items || []).map(item => [item.id, item]));
  const rendering = new Set(discovery.obligations.filter(item => ["presentation", "element", "scene", "destination"].includes(item.kind) && !(item.kind === "element" && item.nonRenderingConfiguration)).map(item => item.path));
  for (const review of inventory.reviews || []) {
    const obligation = actual.get(review.id);
    if (!obligation) throw Error(`Review references an unknown source obligation: ${review.id}`);
    if (reviews.has(review.id)) throw Error(`Duplicate source obligation review: ${review.id}`);
    if (review.blocker) throw Error(`Source obligation is blocked: ${obligation.path}:${obligation.start}: ${review.blocker}`);
    if (obligation.kind === "exclusion" && !nonempty(review.nonUiReason)) throw Error(`Excluded source directory needs a specific non-UI review: ${obligation.path}`);
    if (review.nonUiReason !== undefined) {
      if (!nonempty(review.nonUiReason) || review.items?.length) throw Error("Source review needs either UI items or a specific non-UI reason");
      if (["branch", "presentation", "element", "scene", "destination"].includes(obligation.kind) && rendering.has(obligation.path) && !(obligation.kind === "branch" && obligation.unreachable)) throw Error(`Rendering source cannot be dismissed as non-UI: ${obligation.path}:${obligation.start}`);
    } else {
      if (!Array.isArray(review.items) || !review.items.length) throw Error(`Source obligation has no UI items: ${obligation.path}:${obligation.start}`);
      for (const id of review.items) {
        const item = items.get(id);
        if (!item || !item.sources?.includes(obligation.path)) throw Error(`Source obligation references a missing or unrelated UI item: ${id}`);
      }
    }
    reviews.set(review.id, review);
  }
  const pending = discovery.obligations.filter(item => !reviews.has(item.id));
  if (pending.length) throw Error(`${pending.length} source obligations unreviewed: ${pending.slice(0, 5).map(item => `${item.path}:${item.start} ${item.kind}${item.outcome ? ` ${item.outcome}` : ""}`).join(", ")}`);
  const pairs = new Map();
  for (const obligation of discovery.obligations) {
    if (obligation.kind !== "branch" || !["true", "false"].includes(obligation.outcome)) continue;
    const review = reviews.get(obligation.id);
    if (review.nonUiReason) continue;
    const key = `${obligation.path}:${obligation.offset}`, cases = new Set(review.items.flatMap(id => items.get(id).cases || []));
    const previous = pairs.get(key);
    if (previous && [...cases].some(id => previous.has(id))) throw Error(`Opposite branch outcomes use the same canvas case: ${obligation.path}:${obligation.start}`);
    pairs.set(key, cases);
  }
  const requiredEvidence = Object.create(null);
  for (const obligation of discovery.obligations) {
    const review = reviews.get(obligation.id);
    if (review.nonUiReason) continue;
    const inferred = /(^|\/)ios\//i.test(obligation.path) ? "ios" : /(^|\/)android\//i.test(obligation.path) ? "android" : /\.(swift|m|mm|storyboard|xib)$/i.test(obligation.path) ? "native" : undefined;
    for (const item of review.items.map(id => items.get(id))) for (const id of item.cases || []) {
      if (item.platform !== undefined && !nonempty(item.platform)) throw Error(`Source item needs a named target platform: ${item.id}`);
      const platform = item.platform || inferred;
      (requiredEvidence[id] ||= []).push({ id: obligation.id, ...(platform ? { platform } : {}) });
    }
  }
  for (const [id, values] of Object.entries(requiredEvidence)) requiredEvidence[id] = [...new Map(values.map(value => [`${value.id}:${value.platform || "any"}`, value])).values()];
  return { obligations: actual.size, reviewed: reviews.size, requiredEvidence };
}
