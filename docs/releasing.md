# Release Agent Canvas

The canonical runtime, CLI, skill, references, marketplace and release workflow
all live in this repository. Skill changes ship with the same version as the
CLI. No Tomstack checkout, copied skill or paired release is required.

## Prepare and qualify

1. Update `package.json`, `package-lock.json`, `.claude-plugin/plugin.json`,
   the install pins in `README.md`, `AGENT_GUIDE.md` and
   `skills/agent-canvas/SKILL.md`, and the current `CHANGELOG.md` entry together.
   Run `npm run docs:generate` to refresh all localized install pins. See
   [product localization](localization.md) for the shared launch content contract.
2. Run `npm run check`, `npm test`, `npm run test:onboarding`,
   `npm run check:privacy`, and strict Claude validation of
   `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
   Select additional viewer checks for the change's impact.
3. Commit the candidate. In a clean checkout of that exact commit, install
   dependencies with `npm ci`, then run `npm run release:pack`. Install the
   resulting package in a fresh prefix and run its public CLI. Exercise a
   representative canvas and install the skill for both harnesses in disposable
   homes. Also exercise a managed upgrade from the currently published package;
   preserve locally edited and unmanaged skills. Validate the standalone Claude
   marketplace installation in an isolated Claude configuration.
4. Recheck the promotable base, push the qualified commit to `main`, and wait
   for the required Pages workflow to pass. Verify the hosted `build.json`
   records the same commit and exercise the hosted canvas.

## Publish and verify

Push a `v<package version>` tag pointing to the qualified commit. The
`release.yml` workflow independently checks the tag/version, metadata, unit
tests, packaged onboarding and publication hygiene, then creates the GitHub
Release with its `.tgz` and `SHA256SUMS`. It takes notes from the matching
changelog entry. Do not move an existing published tag.

Download the public release assets and verify the checksum. Without relying on
the maintainer checkout or GitHub credentials, install the public package and
tagged GitHub source, run the CLI and install both skills. Check the independent
Claude marketplace resolves this release's skill and references. Record exact
candidate, checksums and terminal results in ignored local release artifacts.
A release job or successful boot alone is not shipping proof.

On npm 12, a GitHub-source install may require `--allow-git=root` for the direct
requested repository. Scope that option to the install command; do not change
global policy or allow transitive Git dependencies. The checksummed `.tgz`
installation does not need Git admission.

## Free Cloudflare product site

The canonical product site is https://agent-canvas-app.pages.dev/. GitHub Pages
continues to host the synthetic canvas and run its full viewer regression gates;
its marketing documents canonicalize to the product site.

Run `npm run build:product` in a fresh candidate checkout. The output has the
landing at `/`, the complete synthetic demo at `/demo/`, localized guides under
`/about/`, search files, a real 404 page and `build.json` identifying the commit.
The export requires a new output directory; choose another with
`AGENT_CANVAS_PRODUCT_DIR` when retaining an older build for comparison.

Deploy the qualified output with `wrangler pages deploy .artifacts/product
--project-name agent-canvas-app --branch main --commit-hash <qualified-commit>`.
Use the existing authenticated Cloudflare account; do not buy a domain. Read
back the actual deployment, then verify the production alias, commit/version,
404 status, canonical/redirect behavior, assets and the full demo/reference task.

When the event contract changes, qualify and deploy the compatible collector
first, then publish browser assets. Verify an explicitly marked internal canary
from its source event UUID through collector ingestion to PostHog; do not count
that canary as external activation. Never publish collector secrets in assets.
