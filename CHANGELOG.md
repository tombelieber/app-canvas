# App Canvas

## Unreleased

- Add **▶ Demo** for one-click audience presentations of existing journeys,
  including real app interactions, visible action cues, camera follow,
  captions/progress, speed, pause/resume, replay and exit/Esc. Keep the
  existing Browse/Interact and journey controls, with no config migration.
- Keep the shared preview surface and touch culling synchronized with the
  actual canvas camera during gestures and presentation transitions.

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
