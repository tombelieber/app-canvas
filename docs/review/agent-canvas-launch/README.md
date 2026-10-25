# Agent Canvas visual review

Baseline: `946a8bb96ae1d17cd7f07a31d1af0e25faaa2dc1` (comparison base/main).
Candidate rendering: `7292b7a4791ca5b38b99a4e464563caa4a04407c`.
Later evidence-only commits do not change product rendering.

Desktop1440×1000 and phone390×844, device pixel ratio1, English viewer, original
Chinese synthetic application. Matching routes, fixtures and selected states are
used within each pair. Landing Before uses the existing /about/ entry; After uses
the new Cloudflare product root. Both screenshots are real generated pages.

Selected-screen pairs show the same capture-home screen and viewport. The new
reference form is shown in the candidate Inspector. Supplemental after-reference
images show the actual selected button, typed request and copied prompt; no agent
execution or source edit is simulated. Imported pairs use the same synthetic
captured document and selected layer. Phone details are scrolled only as noted
by the visible control context to expose the new handoff on the small viewport.

These public fixtures contain no production accounts, private paths, credentials
or real user data. Original screenshot bytes are retained without image editing.
