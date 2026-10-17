// The catalog keeps every source case. Only inert preview documents are evicted;
// running apps and retained user edits have a separate live-frame lifetime.
export const OVERVIEW_LIMIT = 128;
export function createOverviewLoader({ load, show, evict, error, capacity = OVERVIEW_LIMIT, concurrency = 4 }) {
  const cache = new Map(), active = new Map(), failures = new Map(), waiters = [];
  let wanted = new Map(), queue = [], closed = false;
  const key = source => JSON.stringify([source.id, source.url]);
  function settle() {
    if (!active.size && !queue.length) for (const resolve of waiters.splice(0)) resolve();
  }
  function trim() {
    while (cache.size > capacity) {
      const id = [...cache.keys()].find(id => !wanted.has(id)) ?? cache.keys().next().value;
      cache.delete(id); evict(id);
    }
  }
  function pump() {
    // Reconcile after cancellations too: a rapid A -> B -> A move may want a
    // source whose earlier request is still settling with an aborted signal.
    queue = closed ? [] : [...wanted.values()].filter(source => cache.get(source.id)?.url !== source.url && !active.has(key(source)) && failures.get(source.id) !== source.url);
    while (!closed && active.size < concurrency && queue.length) {
      const source = queue.shift(), token = key(source);
      if (wanted.get(source.id)?.url !== source.url || active.has(token) || cache.get(source.id)?.url === source.url || failures.get(source.id) === source.url) continue;
      const controller = new AbortController(); active.set(token, { source, controller });
      Promise.resolve().then(() => load(source, controller.signal)).then(document => {
        if (closed || controller.signal.aborted || wanted.get(source.id)?.url !== source.url) return;
        cache.delete(source.id); cache.set(source.id, source); trim();
        show(source, document);
      }).catch(cause => {
        if (!closed && !controller.signal.aborted && wanted.get(source.id)?.url === source.url) {
          failures.set(source.id, source.url); error(source, cause);
        }
      }).finally(() => { active.delete(token); pump(); settle(); });
    }
    settle();
  }
  return {
    sync(sources) {
      if (closed) return;
      wanted = new Map(sources.slice(0, capacity).map(source => [source.id, source]));
      for (const job of active.values()) if (wanted.get(job.source.id)?.url !== job.source.url) job.controller.abort();
      for (const source of wanted.values()) {
        const previous = cache.get(source.id);
        if (previous?.url === source.url) { cache.delete(source.id); cache.set(source.id, source); }
        else if (previous) { cache.delete(source.id); evict(source.id); }
      }
      queue = [...wanted.values()]; pump();
    },
    idle() { return !active.size && !queue.length ? Promise.resolve() : new Promise(resolve => waiters.push(resolve)); },
    close() {
      closed = true; queue = [];
      for (const job of active.values()) job.controller.abort();
      for (const id of cache.keys()) evict(id);
      cache.clear(); failures.clear(); wanted.clear(); settle();
    },
  };
}
