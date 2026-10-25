import { sanitizeEvent } from './telemetry-contract.mjs';

// A loopback proxy, never a generic event collector. Browser identity and privacy
// settings are bound to this CLI instance, not chosen by the posted payload.
export async function handleTelemetryRequest(req, res, { telemetry, address, pathname }) {
  if (pathname === '/telemetry.json' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(telemetry ? { ...telemetry.config(), local: true } : { enabled: false, configurable: false }));
    return true;
  }
  if (!['/telemetry', '/telemetry/preference'].includes(pathname)) return false;
  const finish = status => { res.writeHead(status); res.end(); return true; };
  if (!telemetry || req.method !== 'POST' || req.headers.origin !== address || !req.headers['content-type']?.startsWith('application/json')) return finish(403);
  let body = '', size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2048) return finish(413);
    body += chunk;
  }
  let input;
  try { input = JSON.parse(body); } catch { return finish(400); }
  if (pathname === '/telemetry/preference') {
    if (!input || typeof input.enabled !== 'boolean' || Object.keys(input).length !== 1) return finish(400);
    return finish(await telemetry.setEnabled(input.enabled) ? 204 : 503);
  }
  const event = sanitizeEvent(input);
  if (!event || event.id !== telemetry.config().id) return finish(400);
  const ok = await telemetry.capture(event.event, event.properties, { event_id: event.event_id, occurred_at: event.occurred_at });
  return finish(ok ? 204 : 503);
}
