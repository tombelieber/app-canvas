# App Canvas

## 0.10.3

- Verify every addressable case in large catalogs while keeping rendered card contents bounded. The public verification path now supports catalogs larger than the overview rendering budget.

## 0.10.2

- Keep only the latest pending manifest for a slow event-stream client, avoiding unbounded server memory growth while measuring large catalogs.
- Keep Safari shared previews visible through canvas zoom gestures and preserve Demo action focus inside the app frame.

## 0.10.1

- Keep large catalogs responsive by bounding detailed card contents while preserving every case, connection, camera target and retained live app instance.
- Resolve Demo page selection with one catalog pass so opening controls remains responsive at 20,000 cases.

## 0.10.0

- Add **▶ Demo** for one-click audience presentations of existing journeys,
  including real app interactions, visible action cues, camera follow,
  captions/progress, speed, pause/resume, replay and exit/Esc. Keep the
  existing Browse/Interact and journey controls, with no config migration.
- Add whole-app, page and flow Demo playlists with video-style controls:
  0.5×–4× speed, active elapsed/approximate remaining time, a step timeline,
  state-preserving next step, previous/next Demo and explicit skip counts.
- Keep the shared preview surface and touch culling synchronized with the
  actual canvas camera during gestures and presentation transitions.

## 0.9.2

- Recognize parameterized Objective-C superclass initializers when reviewing the nil-construction outcome; actual UI construction and fallback branches still require evidence.
- Identify Android lint configuration by its filename, location and allowed XML tags. Keep native resource XML and unrelated files protected by the rendering-source gate.

## 0.9.1

- Bound passive source DOM loading and retention to 128 documents for large landscapes. Evict their DOM/font resources and cancel obsolete requests while keeping every case addressable.
- Preserve edited live app instances during navigation and keep fallback app renderers within the existing live-frame budget.
- Wait for an explicit true readiness signal before capturing passive source UI; a loading marker cannot become a successful snapshot.
- Keep recognized IDE XML, property-list data and platform backup/network policy in the source review queue without misclassifying their tags as application controls; native UI XML, UI-bearing bundle metadata and permission descriptions still require UI evidence.
- Follow native UI inheritance and implementation ownership so property-based renderers cannot be dismissed as non-UI support when a presentation-call spelling is absent.
- Retain review of canonical nil-initializer outcomes without inventing screens for an object that was never constructed; actual UI construction and error fallbacks still need cases.
- Add a 260-case browser regression and a 15,000-state selection/eviction check; retain the complete ordinary overview and Chromium/WebKit regression gates.

## 0.9.0

- Discover source files, regions, branches, native presentation sites and data records before choosing Canvas cases. Keep unresolved and changed source visible in the population worklist.
- Add `--complete`: require source review, connected cases and source-linked runtime assertions. Native evidence includes build and fixture identities plus checksummed captures. Registered-case verification alone cannot claim complete population.
- Ship the source walkthrough with the canonical skill and exercise the installed CLI completion gate during onboarding and Pages regression checks.
- Account for native legacy branches below a verified declared minimum SDK or deployment target. Keep unsupported build constraints pending and require explicit source review of every excluded outcome.

## 0.8.0

- Own the canonical skill, completion/native references, CLI and releases in
  this repository. The complete UI population contract is retained.
- Add an independent Claude marketplace: install `app-canvas@app-canvas` from
  `tombelieber/app-canvas`. CLI skill installation supports Codex and Claude
  without another marketplace or skill repository.
- Publish checksummed packages from version tags using this repository's
  release workflow. Document migration from the former Tomstack bundle;
  existing `app-canvas@tomstack` listings remain supported links to this source.

Earlier releases are recorded in [GitHub Releases](https://github.com/tombelieber/app-canvas/releases).
