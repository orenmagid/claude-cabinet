---
type: field-feedback
source: flow
date: 2026-04-17
component: skills/orient/SKILL.md
---

## Orient skeleton conflates `pib-db` (a project name) with `pib_*` (a live MCP server)

**Friction:** The `orient` SKILL.md "Scan Work Items" section (lines ~204–260 and the
phase-summary row at ~443) uses `pib_query` as its canonical data-access example. This
conflates two things: (a) "pib-db" as a generic name for a project's work-tracking
SQLite, and (b) `pib_*` as an actual MCP server name that some consuming projects
happen to have loaded. In Flow, the `pib_*` MCP is loaded but points at a DIFFERENT
project (process-in-a-box) with a different schema. Following SKILL.md literally, I
ran four `pib_query` calls during `/orient` today — all four errored with
column-not-found on `articulation_status`, `prep_summary`, `trigger_condition`,
`cabinet_member`. Phase files correctly say "use `flow_*` MCP, fall back to sqlite3
flow.db" but the skeleton's examples are strong enough to pull the model off course.

**Suggestion:** Rename the canonical example to a generic placeholder like
`<project_query>` or `node scripts/workdb.mjs query`. Make explicit that `pib-db` is
the name of ONE consuming project's database, not a generic interface. Also fix the
phase-summary table entry: "Default: pib-db scan + staleness detection" → "Default:
project work-db scan + staleness detection."

**Session context:** `/orient` on Flow — the four erroring pib_query calls were the
first thing that happened after data sync.
