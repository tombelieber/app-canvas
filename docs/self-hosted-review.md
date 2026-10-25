# Self-hosted review

The application repository owns its review build and hosting configuration.
Agent Canvas supplies one viewer and a portable directory; it has no hosted
collaboration service, accounts or access-control backend.

## Build

For a source preview, wrap the existing preview adapter and explicitly approve
publication of the measured synthetic DOM (not arbitrary repository content):

```js
import base from './canvas.config.mjs';
export default {
  ...base,
  preview: async ctx => ({ ...await base.preview(ctx), exportDom: true }),
};
```

```sh
agent-canvas export --config review-export.config.mjs --review-only --out <new-directory>
agent-canvas export --project <saved-capture-project> --review-only --out <another-new-directory>
```

Every registered source case must render and provide a DOM snapshot. Unsupported
canvas/video/shadow or inaccessible-style surfaces fail the build. Existing
native snapshot accelerators are not implicitly published. Captures materialize
the saved revision, including studies, and retain quality/issue labels. Export
reads the project without locking, adoption, recovery writes or mutation; stop
writers during a build so the read represents one consistent saved revision.

The exported project is a frozen DOM/CSS review, not a running application.
Browse, search, page/depth filters, zoom, state graphs and reference links work.
Edit, Save, synthetic app interactions, playback and server events are absent.
Rebuild after source or saved-study changes. Capture coverage remains observed;
registered source cases are not a complete-UI qualification.

## Host and verify

Serve the whole directory unchanged at a root or nested path. Use ordinary
static hosting; there is no Node server to expose or database to provision.
Review the artifact, publication rights, redactions and local assets before
upload. Export is not a general privacy sanitizer. Disabled telemetry metadata
ships by default. Keep organization-specific identities and operational details
in the private consumer repository, outside public Agent Canvas history.

Put authentication in front of the entire site, including document, manifest,
JSON and image URLs. With Cloudflare Access, protect every enabled hostname
(custom domain, default deployment domain and preview aliases), or disable the
alternate entry points. Do not assume preview-only protection secures production.
Avoid SPA fallback for missing assets: a missing JSON/document should be 404.

Before sharing, open every exported case and verify its assets, the saved-study
appearance, search, page selection, zoom and cross-page reference navigation.
Test an allowed teammate and an unauthenticated/denied visitor on the real site,
including direct asset URLs. A successful upload alone is not proof of access
protection or usable canvases.

## Agent workflow and hosting providers

A request such as "share this repo's existing canvases privately for team
review" should follow this contract without rediscovering the renderer:

1. Reuse the consumer's pinned CLI, configs, fixtures and saved capture projects.
   Confirm existing scope; do not infer complete UI coverage from export success.
2. Export to a fresh directory using the commands above. Keep a repeatable build
   script in the consumer repo if it bundles several canvases or adds an index.
3. Use the chosen provider's ordinary static-site workflow. Keep provider files,
   domain, account selection and access policy in the consumer's infrastructure
   boundary; do not add credentials or private configuration to Agent Canvas.
4. Verify the actual deployed documents and assets, an allowed reviewer and a
   denied visitor. Record the source revision and actual verification evidence.
   Future runs reuse this setup and ask only for changed or missing decisions.

Cloudflare Workers Static Assets, Cloudflare Pages and Vercel can host the same
export directory. Use the consumer repo as the deployment source, or upload an
already qualified artifact. Do not configure the Agent Canvas runtime repository
as a substitute source for private app fixtures.

- [Cloudflare static assets](https://developers.cloudflare.com/workers/static-assets/get-started/):
  point `assets.directory` at the export directory. For a custom-domain-only
  private site, disable `workers_dev` and `preview_urls`, protect that hostname
  with Access before connecting the site, and verify direct asset requests.
- [Cloudflare Pages static HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/):
  set the consumer build command and exported output directory. Protect enabled
  production, preview and custom hostnames; preview Access alone is insufficient.
- [Vercel deployment](https://vercel.com/docs/git): import the consumer repo with
  the static output directory. Select the account's supported deployment
  protection and verify all generated URLs. Do not assume protection or private
  organization repository support is included in every plan.

Official [Deploy to Cloudflare](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
and [Deploy with Vercel](https://vercel.com/docs/deploy-button) buttons can later
be added to a reviewed, self-contained public template. They clone/configure a
repository through the provider's setup flow. They are not a generic shortcut to
publish arbitrary private canvases, and do not establish the intended teammate
Access policy. This package currently provides export and hosting guidance;
there is no one-click private deployment or account-provisioning command.
