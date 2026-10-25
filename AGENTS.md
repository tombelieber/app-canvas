# Agent Canvas maintenance

This repository owns the canvas runtime, CLI, canonical `skills/agent-canvas`
contract, references, install channels and releases. Change them here together.
Other repositories may link to Agent Canvas; do not maintain another canonical
copy or require another repository to publish an Agent Canvas release.

Preserve the complete-population and native-runtime contracts when maintaining
the skill. App-specific inventories, fixtures, adapters and captures belong in
the target application, not in this package.

## Checks

Use `npm run check` and `npm test` for local code/metadata changes. Installation
or packaging changes also require `npm run test:onboarding`,
`npm run check:privacy`, and strict validation of both Claude manifests:

```sh
claude plugin validate .claude-plugin/plugin.json --strict
claude plugin validate .claude-plugin/marketplace.json --strict
```

The main-branch Pages workflow contains the required viewer regression gates.
Keep that hosted synthetic demo working; new release automation must not
replace its checks with an install-only smoke.

## Releases

Follow [docs/releasing.md](docs/releasing.md). Keep `package.json`, lockfile,
plugin version and documented install pins in sync. Qualify the exact clean
candidate through the packed CLI and skill paths before promotion. A version
tag triggers this repository's release workflow; no Tomstack release or skill
sync is part of that process. Do not claim shipping until public assets,
independent installation and the hosted build have been verified.
