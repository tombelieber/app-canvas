// Keep one materialized landscape in flight, including during writes. Watch
// events and concurrent HTTP requests must share that work rather than each
// loading and cloning every captured document.
export function snapshotCache(store) {
  let current, pending;
  const accept = next => {
    if (!current || next.project.revision >= current.project.revision) current = next;
    return current;
  };
  const run = task => {
    const work = Promise.resolve().then(task);
    pending = work;
    return work.finally(() => { if (pending === work) pending = undefined; });
  };
  return {
    refresh() {
      if (pending) return pending;
      return run(async () => {
        const metadata = await store.metadata();
        if (!current || current.project.revision !== metadata.revision) accept(await store.read());
        return current;
      });
    },
    update(write) {
      const previous = pending;
      return run(async () => {
        if (previous) await previous.catch(() => {});
        return accept(await write());
      });
    },
  };
}
