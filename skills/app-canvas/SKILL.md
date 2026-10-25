---
name: app-canvas
description: Compatibility name for Agent Canvas. Use the canonical agent-canvas skill and CLI.
---

# App Canvas compatibility name

App Canvas is now **Agent Canvas**. The complete, canonical skill and references
are in [../agent-canvas/SKILL.md](../agent-canvas/SKILL.md). Read that skill before
working on a canvas; this file does not define a separate population contract.

Run `agent-canvas install --target both` to migrate unchanged managed skills to
`$agent-canvas`. The `app-canvas` CLI remains a supported alias. Existing project
storage, configuration and `APP_CANVAS_*` settings remain compatible.
