---
type: field-feedback
source: flow
date: 2026-04-17
component: MCP permissions / settings
---

## MCP tool "Always Allow" doesn't persist across sessions

**Friction:** Every session, MCP tool calls prompt for approval even
after clicking "Always Allow" in prior sessions. Affects both
`mcp__omega-memory__*` tools (omega_welcome, omega_protocol, omega_store)
and `mcp__flow__*` tools (flow_get_comments, flow_forecast,
flow_get_actions, flow_get_projects, flow_inbox_counts). The "Always
Allow" affordance appears to do nothing — the next session prompts
again. Orient especially hits this wall because it calls omega and flow
MCP tools in its first batch, so the user faces N permission dialogs
before anything useful happens.

**Suggestion:** Either (a) persist "Always Allow" for MCP tools into
`.claude/settings.local.json` automatically so the decision sticks,
(b) make the CC installer/orient surface a recommended allowlist for
the MCPs the project declares in `.mcp.json`, or (c) add a
`less-permission-prompts`-style scan that detects repeatedly-approved
MCP tools and offers to batch-add them to settings. Option (c)
composes well with the existing less-permission-prompts skill.

**Session context:** `/orient-quick` in flow — every MCP call in the
opening parallel batch (omega_welcome, flow_inbox_counts,
flow_forecast, flow_get_actions, flow_get_projects, flow_get_comments)
triggered a separate approval prompt despite prior "Always Allow"
clicks.
