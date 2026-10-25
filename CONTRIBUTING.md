# Contributing to Agent Canvas

Agent Canvas is free MIT software. Bug reports, reproducible examples,
documentation improvements and focused pull requests are welcome.

Start with an [issue](https://github.com/tombelieber/app-canvas/issues) describing
what you expected and what happened. Use synthetic data and remove application
content, credentials and personal paths. Report vulnerabilities privately as
described in [support](docs/support.md).

For code changes, use Node.js 22 or later, run `npm ci`, `npm run check` and
`npm test`. Installation or packaging changes also need `npm run test:onboarding`,
`npm run check:privacy` and strict validation of both Claude plugin manifests.
Run the relevant browser checks for changed behavior. Preserve both CLI aliases,
existing project libraries, and the source-backed and native-runtime contracts.

UI pull requests need comparable before/after screenshots, including a phone
view for responsive changes. Use synthetic fixtures and describe the captured
revision, viewport and changed behavior.

To try the build-first workflow with your own project, follow the
[agent guide](AGENT_GUIDE.md). Tell us whether you could see your app, reference
an element, ask your agent to change it, and review the result. A download or
demo visit alone does not establish that this workflow works for your project.
