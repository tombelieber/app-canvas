# Release App Canvas

The canonical runtime, CLI, skill, references, marketplace and release workflow
all live in this repository. Skill changes ship with the same version as the
CLI. No Tomstack checkout, copied skill or paired release is required.

## Prepare and qualify

1. Update `package.json`, `package-lock.json`, `.claude-plugin/plugin.json`,
   the install pins in `README.md`, `AGENT_GUIDE.md` and
   `skills/app-canvas/SKILL.md`, and the current `CHANGELOG.md` entry together.
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
