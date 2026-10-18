import { languages } from "../../lib/locales.mjs";
const publicOrigins = new Set(["https://tombelieber.github.io", "https://tomtang3.ai"]);
const json = (body, status = 200, origin) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", ...(origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}) } });
const hash = async text => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(x => x.toString(16).padStart(2, "0")).join("");
async function body(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw Error("invalid");
  if (Number(request.headers.get("content-length")) > 2048) throw Error("invalid");
  const reader = request.body?.getReader(); if (!reader) throw Error("invalid");
  let size = 0, chunks = [];
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 2048) { await reader.cancel(); throw Error("invalid"); } chunks.push(part.value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function validEmail(value) {
  return typeof value === "string" && value.length <= 254 && /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i.test(value);
}
export async function handle(request, env, ctx = { waitUntil() {} }) {
  const path = new URL(request.url).pathname, origin = request.headers.get("Origin");
  const allowed = publicOrigins.has(origin) || env.LOCAL_TEST === "1" && /^http:\/\/127\.0\.0\.1:\d+$/.test(origin || "");
  if (path === "/health" && request.method === "GET") return json({ service: "app-canvas", waitlist: "cloudflare-d1", version: env.RELEASE_VERSION || "development" });
  if (!["/waitlist", "/waitlist/remove", "/capture"].includes(path)) return json({ error: "not_found" }, 404);
  // The capture endpoint also accepts official CLI requests with no Origin.
  if (!allowed && !(path === "/capture" && !origin)) return json({ error: "origin" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600", "Vary": "Origin" } });
  if (request.method !== "POST") return json({ error: "method" }, 405, allowed ? origin : undefined);
  try {
    const limiter = path === "/capture" ? env.EVENT_LIMIT : env.WAITLIST_LIMIT;
    if (!limiter || !(await limiter.limit({ key: request.headers.get("CF-Connecting-IP") || "unknown" })).success) return json({ error: "rate_limit" }, 429, allowed ? origin : undefined);
    let input; try { input = await body(request); } catch { return json({ error: "invalid" }, 400, allowed ? origin : undefined); }
    if (path === "/capture") return await capture(input, env, allowed ? origin : undefined);
    if (path === "/waitlist/remove") {
      if (!input || Object.keys(input).some(k => !["email", "token"].includes(k)) || !validEmail(input.email) || !/^[a-f0-9]{64}$/.test(input.token || "")) return json({ error: "invalid" }, 400, origin);
      await env.DB.prepare("DELETE FROM waitlist WHERE email = ? AND removal_hash = ?").bind(input.email.trim().toLowerCase(), await hash(input.token)).run();
      return json({ ok: true }, 200, origin);
    }
    if (!input || Object.keys(input).some(k => !["email", "locale", "consent", "company"].includes(k))) return json({ error: "invalid" }, 400, origin);
    if (input.company) return json({ ok: true }, 200, origin);
    if (!validEmail(input.email?.trim()) || !languages.includes(input.locale) || input.consent !== true) return json({ error: "invalid" }, 400, origin);
    const day = new Date().toISOString().slice(0, 10);
    const budget = await env.DB.prepare("INSERT INTO daily_budget (day, submissions) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET submissions = submissions + 1 WHERE submissions < 500 RETURNING submissions").bind(day).first();
    if (!budget) return json({ error: "capacity" }, 429, origin);
    const email = input.email.trim().toLowerCase(), token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const isTest = /@(?:example\.(?:com|org|net)|[^@]+\.invalid)$/.test(email) ? 1 : 0;
    await env.DB.prepare("INSERT INTO waitlist (id, email, locale, consent_version, removal_hash, is_test) VALUES (?, ?, ?, '2026-10', ?, ?) ON CONFLICT(email) DO NOTHING").bind(crypto.randomUUID(), email, input.locale, await hash(token), isTest).run();
    // A duplicate never receives the existing record's removal credential.
    // The response shape stays the same to avoid an email-existence oracle.
    return json({ ok: true, removalToken: token }, 200, origin);
  } catch { return json({ error: "unavailable" }, 503, allowed ? origin : undefined); }
}
async function capture(input, env, origin) {
  const { sanitizeEvent } = await import("../../lib/telemetry-contract.mjs");
  const event = sanitizeEvent(input); if (!event) return json({ error: "invalid" }, 400, origin);
  if (!env.POSTHOG_TOKEN) return json({ error: "unavailable" }, 503, origin);
  const budget = await env.DB.prepare("INSERT INTO event_budget (day, events) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET events = events + 1 WHERE events < 5000 RETURNING events").bind(new Date().toISOString().slice(0, 10)).first();
  if (!budget) return json({ error: "capacity" }, 429, origin);
  const response = await fetch("https://us.i.posthog.com/i/v0/e/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: env.POSTHOG_TOKEN, event: event.event, distinct_id: `${event.properties.product}:${event.id}`, properties: { ...event.properties, $process_person_profile: false, $geoip_disable: true, $ip: null } }), signal: AbortSignal.timeout(4000) });
  let receipt; try { receipt = await response.json(); } catch {}
  const ok = response.ok && receipt && !receipt.quota_limited?.length && !receipt.error;
  return json({ ok: !!ok }, ok ? 200 : 503, origin);
}
export default { fetch: handle, async scheduled(_event, env) { await env.DB.batch([env.DB.prepare("DELETE FROM waitlist WHERE created_at < datetime('now', '-365 days')"), env.DB.prepare("DELETE FROM daily_budget WHERE day < date('now', '-7 days')"), env.DB.prepare("DELETE FROM event_budget WHERE day < date('now', '-7 days')")]); } };
