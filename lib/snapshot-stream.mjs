// Manifest events replace prior snapshots. A slow client needs the newest
// snapshot after drain, rather than an unbounded queue of obsolete snapshots.
export function snapshotStream(response, onClose = () => {}) {
  let pending, blocked = false, closed = false;
  const flush = () => {
    if (closed || blocked || !pending) return;
    const render = pending;
    pending = undefined;
    blocked = !response.write(render());
  };
  const drain = () => { blocked = false; flush(); };
  const dispose = () => {
    if (closed) return;
    closed = true;
    pending = undefined;
    response.off('drain', drain);
    response.off('close', dispose);
    response.off('error', dispose);
    onClose();
  };
  response.on('drain', drain);
  response.once('close', dispose);
  response.once('error', dispose);
  return {
    push(render) { if (!closed) { pending = render; flush(); } },
    end() { if (!closed) { dispose(); response.end(); } },
  };
}
