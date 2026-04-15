# cabinet-cc-health Calibration Examples

## Findings (real issues)

**Phase coverage gap:** "Project has a SQLite database (`flow.db`, 14 tables,
used in 8 API routes) but the `data-sync.md` phase file in the validate skill
is empty — no project-specific data integrity checks are defined. The default
skeleton phase has no awareness of the project's schema, WAL mode, or sync
architecture. This means validate runs skip data integrity entirely."
Severity: warn. Evidence: file is empty + project clearly needs it.

**Dead-weight cabinet member:** "The `small-screen` cabinet member has
produced 0 approved findings in the last 4 audit cycles (8 weeks). The
project is a CLI tool with no web UI. This cabinet member was likely carried
over from a template and never removed. Recommend retirement per
`_lifecycle.md` criteria."
Severity: info. Evidence: triage history + project type mismatch.

**Stale context:** "`_briefing.md` lists Express.js 4.x as the server
framework, but `package.json` shows the project migrated to Hono three weeks
ago. Three cabinet members reference Express middleware patterns in their scan
scopes. These cabinet members are partially blind to the current server
architecture."
Severity: warn. Evidence: `_briefing.md` content vs `package.json` delta.

**Telemetry gap:** "Hook telemetry JSONL hasn't been written to in 12 days,
but the project had 8 Claude Code sessions in that period (per git log).
Either the telemetry hook isn't firing or its output path is misconfigured.
Without telemetry, Check 4 (skill usage) cannot be assessed."
Severity: warn. Evidence: file modification date + git activity.

## Not findings (valid states)

**Defaults that work:** "The `briefing.md` phase file uses the skeleton
default. The default covers daily orientation, which matches this project's
needs. No customization required." — Defaults are a valid choice. Not every
phase file needs project-specific content. Only flag defaults when there's
concrete evidence that the project needs something different.

**Recently adopted cabinet member:** "The `security` cabinet member was added 5 days
ago and has run in 1 audit cycle. It produced 2 findings, both pending triage."
— New cabinet members need a few cycles to accumulate triage data. Don't flag
them as zero-signal until they've had a fair chance (3+ cycles).

**Intentionally minimal configuration:** "Project has only 4 cabinet members
active across 2 committees. The project is a small CLI utility with no database,
no UI, and no deployment pipeline." — A minimal project should have minimal
CC configuration. Absence of cabinet members is only a finding when the
project's complexity warrants them.

## Severity Anchors

- **critical** — Enforcement layer silently broken (hooks not firing, telemetry
  dead, settings.json missing required entries). The system thinks it has
  guardrails but doesn't.
- **warn** — Configuration doesn't match project reality (empty phases that
  should be customized, stale context, dead-weight cabinet members producing
  noise). The system is working but poorly fitted.
- **info** — Optimization opportunities (retirement candidates, promotion
  bottlenecks, minor drift). The system works but could be leaner or
  more current.
