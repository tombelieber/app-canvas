# Desktop URL capture into App Canvas

Use this path when the user supplies a website URL and wants an editable
landscape of its observed screens, states and flows. Output remains App Canvas.
Use the source/native completion contract when the input is an application
repository; URL imports never substitute for its complete-population evidence.

This path is unreleased. Verify `app-canvas --help` includes `import` and `open`;
the existing public v0.10.3 install pin does not contain these commands. Use a
verified development checkout or a later qualified release. Read the matching
package's `docs/url-import.md` for the format, controls, fidelity and limits.

1. Run `app-canvas import <URL> --out <new-private-directory>`. Use the printed
   App Canvas URL and dedicated 1440 × 1000 Chromium capture browser. The user
   completes normal login where needed; never copy sessions or credentials.
2. Observe read-only navigation and controls. Capture distinguishing visible
   states with Capture State or Alt+Shift+C. Do not publish, connect accounts,
   create drafts, accept agreements, pay or modify website data just to discover
   UI. Respect the task's actual authorization; inspect possible autosave first.
3. Review partial issues and local assets against the source. Verify a nested
   menu, scrollable content and meaningful transitions for the scoped product.
   Captured status is structural evidence, not a pixel-fidelity guarantee.
   Counts describe observations, never exhaustive or inferred product coverage.
4. Exercise selection, text/style/geometry edits, duplicate/history/reset and
   Save through App Canvas. Close capture and run `app-canvas open <directory>`;
   verify persisted edits and local state navigation without source requests.
5. Report the working App Canvas URL, saved directory, actual states/flows,
   exercised edits and access/fidelity blockers. Keep captures, credentials,
   profiles and competitor strategy outside public source and package artifacts.

Imported website scripts never execute in playback. Known unsupported regions
remain partial/read-only. Common identity patterns are redacted but captures can
still contain sensitive visible content; inspect before any authorized sharing.
Other accounts, trial signup, self-hosting and public publication require their
own scope and authority. Do not silently turn access delays into engine tests or
claim an inaccessible dashboard has been qualified.
