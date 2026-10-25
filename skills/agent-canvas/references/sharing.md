# Sharing existing canvases

Use this for explicitly requested review-only sharing of existing cases. It does
not widen source population, authorize new recipients or qualify app production.

Use the pinned shared CLI, not a copied renderer:

```sh
agent-canvas export --config review-export.config.mjs --review-only --out <new-directory>
agent-canvas export --project <saved-capture-project> --review-only --out <new-directory>
```

Source adapters explicitly opt in with `exportDom: true`; every registered case
needs a DOM snapshot. Captures preserve the saved materialized revision and its
quality/issues without publishing history. There is no Edit, Save or app runtime.

Keep repeatable builds, provider configuration and deployment records in the
consumer repo. Export is provider-neutral. Use ordinary static hosting and the
user's existing access guard; verify real allowed and denied actors, direct
assets and alternate hostnames. Do not provision SaaS, a database, tenancy,
billing or a second renderer for this workflow. Preserve private captures.

See the matching package's `docs/self-hosted-review.md` or the
[canonical hosting guide](https://github.com/tombelieber/app-canvas/blob/main/docs/self-hosted-review.md)
for provider choices, official deploy-button limits and the agent workflow.
