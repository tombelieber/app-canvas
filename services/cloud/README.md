# Agent Canvas usage and Cloud interest service

Cloudflare Workers + D1 only. No Supabase dependency.

The public Worker serves a consent-based waitlist, credential-bound removal
and an allowlisted anonymous PostHog proxy. It never hosts user app repositories.
The cloud workspace itself has not launched.

Deploy under an existing, qualified Workers Free account. Use a dedicated D1
DB named `app-canvas-waitlist`; replace the database ID for your own account.
The Free plan enforces its own CPU ceiling; do not configure `limits.cpu_ms`,
which is a paid-plan setting and causes Free-plan deployments to be rejected.
The checked-in ID is the public demo's resource identifier, not a credential.
Do not bind another product's database.

```sh
wrangler d1 migrations apply DB --local
wrangler dev --var LOCAL_TEST:1
# After local verification and Free-plan/capacity checks:
wrangler d1 migrations apply DB --remote
wrangler secret put POSTHOG_TOKEN
wrangler deploy
```

`LOCAL_TEST` is only for local tests; never deploy that variable. Production
origins are explicit in worker.mjs. Loopback is accepted only with LOCAL_TEST.
No preview/private development origin is implicitly authorized. The CLI capture
route accepts no-Origin clients but still enforces the event schema and limits.
CORS is not authentication. The service exposes no email reads.

Waitlist requests: 8/minute per network address per Cloudflare rate-limit region,
plus an atomic global 500-submission/day D1 cap. The Free plan provides the
billing boundary; rate limiting is abuse mitigation, not a security identity.
Capture is also capped at 5,000 attempts/day globally before sending to PostHog.
The daily scheduled task expires 365-day registrations and old budget records.
Requests and bodies are not logged. Inspect only aggregates for operational QA.
Keep canary addresses on reserved example domains and remove them with their
returned code after verification. Never report canaries as market demand.

Capture requires POSTHOG_TOKEN (public ingest class, stored as a Worker secret).
The publisher's destination is the shared **Product** PostHog project.
This collector only accepts Agent Canvas events, fixes the legacy `product=app_canvas` and
`schema_version=1`, and prefixes distinct IDs with `app_canvas:`. Future OSS
tools may share the destination but must use their own fixed product value,
event contract and scoped identities. Product filters are not access control;
see [the shared analytics contract](../../docs/telemetry.md#shared-product-analytics-project).
Without it the endpoint returns unavailable. Do not call that analytics-ready.
Set RELEASE_VERSION to the exact promoted package version. Verify actual
PostHog ingestion as well as HTTP delivery before claiming analytics shipped.

Deploy the collector's expanded `environment` and `cohort_class` allowlists before distributing
clients that send this field. Legacy clients that omit it remain valid and
receive `unknown`; only `internal_test` and `unknown` are accepted from clients.
Missing environment remains accepted as `unknown`, while qualification traffic
is forced to `qualification`. Deployment and audience remain independent.
The ingestion-side verified audience mapping may then override the audience value.
Do not roll the collector back to a contract that rejects a supported client.

The canonical Cloudflare landing origin is explicitly allowed as
`https://agent-canvas-app.pages.dev`; sibling projects and preview hosts are not.
Deploy the collector before new launch clients that send random action/session
IDs, bounded acquisition enums or reference-copy outcomes. Old payloads remain
valid. Event UUID and source timestamp are forwarded to PostHog for correlation;
no user-selected reference contents or errors are forwarded. See the event and
attribution dictionary in docs/telemetry.md. The unchanged Worker hostname,
database binding and PostHog product slug preserve existing installations and
opt-outs; they are compatibility identifiers, not unrebranded product copy.
