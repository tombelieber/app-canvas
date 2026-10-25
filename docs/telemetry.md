# Privacy and usage analytics

Official CLI downloads enable minimal usage analytics by default. The first
normal CLI run prints a notice. No SDK scans the app, DOM or repository.

```sh
agent-canvas telemetry status
agent-canvas telemetry off
agent-canvas telemetry on
agent-canvas telemetry dogfood
agent-canvas telemetry unknown
```

`APP_CANVAS_TELEMETRY=0`, `DO_NOT_TRACK=1`, and CI disable transmission and
prevent the viewer from overriding that choice. The Panels menu also offers a
persistent toggle. Browser Do Not Track and Global Privacy Control are honored.
Blocked storage disables browser capture. Analytics failure never blocks the
canvas, installation or app interactions.

## What is sent

Only the allowlisted event name, fixed product/schema identifiers, random installation/browser ID, tool version,
source channel, one of the fixed product surfaces, selected language and fixed
landing-page/CTA enums, deployment environment and an optional self-declared usage audience. Installations and browsers are **not people**. Events
from the public synthetic demo are **not activation in a real repository**.
Qualification traffic has its own surface and must be excluded from adoption
reports. Opt-outs and blockers mean observed usage is incomplete.
The source channel is `unknown` for ordinary CLI invocations unless a known
installer explicitly supplies `APP_CANVAS_INSTALL_SOURCE`. Running a command
does not establish whether npm, npx, a tarball or a GitHub install delivered it.
The other accepted source enums are `install_sh`, `plugin`, `npx`, `local` and
`browser`; source is independent of the product surface and acquisition channel.

Events also carry a random per-action UUID and occurrence timestamp for delivery
correlation. Browsers include a random tab-session UUID shared by landing and
demo pages on the same origin. No source, selected element, selector, prompt,
reference contents, stack trace or error message is included. A copied reference
can contain local application context on your clipboard; its contents are never
included in the analytics event.

## Events and first success

| Event | Authoritative producer and meaning | What it does not prove |
| --- | --- | --- |
| `landing_view` | Product, quickstart or release page loaded with analytics allowed | A human visit, installation or activation |
| `landing_cta` | A known CTA was clicked; `action` is a fixed enum | The destination succeeded |
| `install` | The CLI skill installer returned successfully, once per version/source/anonymous installation | An npm download, browser install, active user or completed app integration |
| `viewer_ready` | The viewer's analytics configuration loaded | Every preview loaded or the user received value |
| `screen_selected`, `interaction_started` | A user selected a screen or entered interaction mode | The underlying app action succeeded |
| `flow_started`, `flow_completed` | A checked authored journey began or reached its terminal complete state | A production backend transaction or agent-generated edit succeeded |
| `flow_failed` | A checked authored journey stopped in error; fixed `error_code=journey_failed` | The private step, screen or exception contents |
| `reference_copied` | Writing a selected UI reference to the clipboard resolved successfully | An agent received it or applied the requested change |
| `reference_copy_failed` | Clipboard writing failed; fixed `error_code=clipboard_unavailable` | The private exception message or failed reference contents |
| `locale_changed` | A supported viewer locale changed | Product adoption |

For source-backed projects, a first observed `flow_completed` on
`surface=real_project` is terminal evidence of a checked product journey. A
successful `reference_copied` is evidence of the handoff capability only. Report
these separately. A later completed real-project journey is repeat observed use;
the reporting window must be explicit. Official synthetic demo completions stay
on `official_demo` and never count as real-project activation. URL imports also
support safe reference-copy events through the official CLI's loopback proxy;
library callers keep telemetry disabled unless they explicitly supply it.

The strict contract accepts old payloads without correlation fields. New
per-action IDs are forwarded as the PostHog event UUID, with the source timestamp,
so resending the same payload retains its identity rather than inventing another
action. Clients do not retry in a background loop. CLI skill-install notices are
locally claimed once to avoid duplicate beacons; failed delivery can therefore
undercount successful installs.

## Acquisition attribution

Public launch links may use only known tokens, for example:

```text
https://agent-canvas-app.pages.dev/?ac_source=reddit_showcase&ac_campaign=oss_launch
```

`acquisition_source` is one of `direct`, `organic_search`, `github`,
`github_release`, `reddit_showcase`, `founder_social` or `unknown`. `campaign`
is one of `oss_launch`, `build_in_public` or `unknown`. The first recognized
touch is stored locally on that origin and reused by its landing and demo
events. Recognized search/GitHub referrer hosts are converted locally to these
enums; the raw referrer, URL, query string and arbitrary UTM values are never
stored by the application or forwarded. Unrecognized attribution stays unknown.

The same-origin browser ID can connect a landing CTA to later demo use. It does
not identify the same person across browsers, devices, Cloudflare and GitHub
origins, or a separately installed CLI. Browser-to-CLI conversion remains
unavailable rather than being inferred from timestamps. Campaign tags do not
certify an external user. Publishers may mark their own test browser with local
`app-canvas:telemetry-cohort=internal_test`; this can only exclude self-declared
internal usage, never certify external status.

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

## Identifying your own usage

Run `agent-canvas telemetry dogfood` once on your own installation. Future CLI
and local-viewer events carry `cohort_class: "internal_test"`. This persists
across restarts without changing your anonymous ID or analytics preference.
Reload an already-open viewer after changing the preference.
`agent-canvas telemetry unknown` clears the declaration. For temporary use,
`APP_CANVAS_DOGFOOD=1` or `APP_CANVAS_COHORT_CLASS=internal_test` labels that process only. Neither setting enables
disabled analytics or overrides CI, Do Not Track or Global Privacy Control.

Unmarked installations are **Unknown**, not confirmed External. A client can
self-declare Dogfood to exclude its own usage; it cannot certify itself as an
external customer. Publisher-side verified account/install mappings remain
private and product-specific. No email or account ID is added to the payload.
Classification applies to new events; earlier events are not rewritten.

## Shared product analytics project

Publisher-operated tools share one PostHog project, **Product**.
Agent Canvas events always carry `product: "app_canvas"` and `schema_version: 1`.
The legacy slug, scoped IDs, local preference keys and collector hostname remain
stable through the product rebrand so opt-outs, classifications and history are
preserved. A brand rename does not create a new analytics identity or project.
Event names describe actions (`viewer_ready`, `flow_completed`); `surface`
separates demo, real-project, landing and qualification traffic, while `source`
identifies the distribution channel. Do not infer product from an app name,
repository URL or event-name substring.

`environment` describes deployment (`production`, `development`, `staging`,
`test`, `qualification`, or `unknown`), independently of usage audience.
Official demo/landing and normal installed CLI usage stamp `production`; a local
CLI is an installed product, not automatically a development build. Developers
can set `APP_CANVAS_ENVIRONMENT`. Qualification surfaces always stamp
`qualification`. Older payloads remain accepted as `unknown`; no historical
event or installation ID is rewritten.

The Agent Canvas collector rejects other product values and sends a distinct ID
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
