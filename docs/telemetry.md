# Privacy and usage analytics

Official CLI downloads enable minimal usage analytics by default. The first
normal CLI run prints a notice. No SDK scans the app, DOM or repository.

```sh
app-canvas telemetry status
app-canvas telemetry off
app-canvas telemetry on
```

`APP_CANVAS_TELEMETRY=0`, `DO_NOT_TRACK=1`, and CI disable transmission and
prevent the viewer from overriding that choice. The Panels menu also offers a
persistent toggle. Browser Do Not Track and Global Privacy Control are honored.
Blocked storage disables browser capture. Analytics failure never blocks the
canvas, installation or app interactions.

## What is sent

Only the allowlisted event name, fixed product/schema identifiers, random installation/browser ID, tool version,
source channel, one of the fixed product surfaces, selected language and fixed
landing-page/CTA enums. Installations and browsers are **not people**. Events
from the public synthetic demo are **not activation in a real repository**.
Qualification traffic has its own surface and must be excluded from adoption
reports. Opt-outs and blockers mean observed usage is incomplete.

The collector rejects additional fields, arbitrary names and invalid values.
It never forwards preview contents, source code, app/repository/screen names,
file paths, fixture values, email, full URLs, referrers, browser user agents or
client IPs to PostHog. There is no autocapture, session replay, identify/alias,
exception capture or person-profile creation. IP/GeoIP enrichment is disabled
in the capture payload. Cloudflare necessarily processes network addresses to
deliver requests and rate-limit abuse; the application does not store them.

Telemetry IDs and preferences live locally in
`~/.config/app-canvas/telemetry.json` for CLI and localStorage for browsers.
No home directory or file path is transmitted. The browser choice is shared
between the public viewer and launch pages on the same origin.

## Self-hosting and source integrations

`startCanvas()` as a library and generic static exports make no telemetry
requests by default. The official public demo explicitly enables its collector.
A self-hosted export can omit telemetry.json or keep its generated disabled
configuration. CLI operators can disable analytics with the controls above or
set `APP_CANVAS_TELEMETRY_ENDPOINT` to their own HTTPS collector implementing
`lib/telemetry-contract.mjs`. No vendor key or personal API token is required in
user repositories. The publisher's ingest key is a Worker secret, never a
management credential in the package.

## Shared OSS analytics project

Publisher-operated tools share one PostHog project, **Product**.
App Canvas events always carry `product: "app_canvas"` and `schema_version: 1`.
Event names describe actions (`viewer_ready`, `flow_completed`); `surface`
separates demo, real-project, landing and qualification traffic, while `source`
identifies the distribution channel. Do not infer product from an app name,
repository URL or event-name substring.

`environment` describes deployment (`production`, `development`, `staging`,
`test`, `qualification`, or `unknown`). It is independent of audience:
`External`, `Dogfood`, or `Unknown`. Official demo/landing and normal installed
CLI usage stamp `production`; a local CLI is an installed product, not
automatically a development build. Developers can set `APP_CANVAS_ENVIRONMENT`.
Qualification surfaces always stamp `qualification`.

To exclude your own CLI usage, set `APP_CANVAS_COHORT_CLASS=internal_test`.
This affects audience only, never environment or consent. Browser ownership
uses verified product-scoped IDs in the collector transformation. Clients
cannot self-certify External. Older payloads without environment remain
accepted as `unknown`; no stored event or installation ID is rewritten.

The App Canvas collector rejects other product values and sends a distinct ID
prefixed with `app_canvas:`. This keeps IDs from different tools separate even
when their locally generated identifiers happen to match. No cross-product
identify/alias or person-profile creation is performed. Each additional tool
must have its own fixed product slug, scoped IDs and validated event contract;
sharing the analytics destination does not require a shared unrestricted
collector. Existing products are not migrated automatically.

Every product dashboard, insight and funnel must filter on the exact product
property. Adoption queries also exclude `surface: "qualification"` and keep
official-demo traffic separate from actual repository use. The project shares
access permissions, retention, settings and usage quota across these tools;
property filters are not an authorization boundary. Use a separate project
when ownership, access or privacy requirements differ. A separate account is
not needed for this setup. The waitlist database remains App Canvas-specific.

See [PostHog project boundaries](https://posthog.com/docs/settings/projects) and
[shared-project identity isolation](https://posthog.com/docs/data/embedded-analytics-projects).

## Cloud waitlist

Cloud is an interest list, **not a launched hosted service**. Its separate
Cloudflare Worker stores normalized email, locale, explicit consent version,
creation time and a hashed removal code in a dedicated D1 database. No
Supabase service, account, payment or automatic email delivery is involved.
Addresses on reserved example domains are qualification data, not demand.

No signup count, rank or referral number is fabricated. Duplicates receive a
generic response without exposing whether an address exists. New registrations
receive a removal code; existing registrations retain their original code.
Use the launch page's removal form with the original email and code to delete
the record. Data expires after 365 days. Keep the daily retention task enabled.
Neither the email nor removal code is sent to analytics. Network/request body
logging is disabled in the Worker. Only operators with Cloudflare database
access can read the waitlist; there is no public listing/export/admin endpoint.

Sources: [PostHog anonymous events](https://posthog.com/docs/product-analytics/capture-events#advanced-anonymous-vs-identified-events),
[PostHog GeoIP controls](https://posthog.com/docs/libraries/python#geoip-properties),
[Cloudflare D1](https://developers.cloudflare.com/d1/),
[Worker rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
