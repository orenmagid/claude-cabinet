---
type: field-feedback
source: article-rewriter
date: 2026-05-28
component: install.sh (--migrate-memory)
status: resolved
resolution: cc-upgrade omega sweep now strips mcp__omega-memory__* from settings.local.json (commit b29a6d4, shipped v0.27.4)
---

## --migrate-memory doesn't clean settings.local.json omega permissions

**Friction:** After `--migrate-memory` completed (state=complete), `settings.local.json` still contained 5 `mcp__omega-memory__*` tool permissions (`omega_store`, `omega_welcome`, `omega_protocol`, `omega_call`, `omega_tools`). The migration strips omega hooks and MCP entries from `~/.claude/settings.json` but doesn't touch per-project `settings.local.json` permission allowlists. These are inert (the server is gone) but stale — found by record-keeper during debrief.

**Suggestion:** The migration's teardown should also scan `.claude/settings.local.json` in the project directory and remove any `mcp__omega-memory__*` permission entries. Alternatively, the cc-upgrade omega sweep (omega-migration-detect.md) could handle this alongside the inert file cleanup.

**Session context:** Post-migration debrief in article-rewriter; record-keeper cabinet member flagged the stale permissions during its staleness check.
