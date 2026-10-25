# Point to UI and ask your agent to change it

Agent Canvas starts from the real app your coding agent has built. It does not
require a separate design file or a hosted model account.

1. Select a screen on the canvas. Use **Interact** to try its real controls.
2. In the screen details, choose **Point to an element**, then click the target.
   Picking captures a reference instead of activating the control. Press Escape
   to cancel. Native captures support screen references rather than DOM picking.
3. Write the change in **What should change?** and choose **Copy change request**.
   Review the request before sharing it; it can contain local source and UI context.
4. Paste it into Claude Code, Codex or another agent working in the same source
   project. The request includes the screen, source and selected element when available.
5. Let your agent make the source change, then review the updated preview. A local
   source-backed canvas watches its project files and rebuilds the original UI.

If clipboard access is unavailable, expand **Review or copy the request** and
copy the text manually. A success message appears only after a successful copy.

## What the handoff does

The copy button does not call an AI service or submit code changes. Your agent
receives context only when you paste it. Reference text, selectors, instructions
and source paths are not sent to analytics. Usage analytics records only fixed
success/failure event names and bounded metadata; see [telemetry](telemetry.md).

For a URL-import project, the selected layer belongs to a captured local
alternative. It is not a verified source mapping. Your agent needs the matching
application source to implement the requested change. Visual edits to a captured
alternative do not change the original website.

The public demo uses a frozen synthetic app. You can try the reference handoff,
but it does not run an agent or change your repository.
