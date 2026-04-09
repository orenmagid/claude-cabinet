# Work Tracking — Choose How to Track Work

After the interview and before generating context, surface how the project
tracks work — or start tracking if nothing exists yet. This phase presents
two built-in options plus bring-your-own. The user chooses one, the other,
or neither.

When this file is absent or empty, the default behavior is: detect existing
work tracking, present options, record the choice in `.corrc.json`. To skip
work-tracking decisions entirely, write only `skip: true`.

## When This Phase Activates

This phase runs in all onboard modes (first-run, early re-run, mature re-run).

- **First-run:** Present the two default options, ask user to choose
- **Early re-run:** Show what's currently set up, ask if it's working well
- **Mature re-run:** Review what's being used, surface if it's time to switch

## Detection: What Already Exists

Before presenting options, scan for signs of existing work tracking:

1. **pib.db** — SQLite database from a previous CC install or work-tracking
   module selection
2. **Markdown task files** — `tasks.md`, `TODO.md`, `backlog.md`, `work.md`
   in the project root or `docs/`
3. **GitHub Issues** — `gh issue list` returns results (if `gh` CLI is available)
4. **Custom work-scan phase** — `.claude/skills/orient/phases/work-scan.md`
   with non-default content
5. **`.corrc.json` workTracking field** — Previous choice already recorded

If something is already set up and working, acknowledge it: "I see you're
using [X]. Is that working well, or would you like to try something
different?" Don't re-present the full menu unless the user wants to switch.

## Detecting Prior Interview Context

If the interview already revealed how work is tracked ("I use GitHub Issues",
"I keep a list in Notion"), reference that answer here. Don't re-ask.
Instead: "You mentioned using [system]. Should we wire the session loop to
that, or would you like to try one of these built-in options?"

## The Two Built-In Options

### Option A: SQLite Database (pib-db)

**What it is:** A lightweight, local SQLite database with semantic IDs,
status tracking, project containers, and tagging. The reference data layer
that CC skills (orient, debrief, plan) use by default.

**Good for:**
- Projects that want zero external dependencies (no API keys, no service)
- Projects where work is created from plans (plan → action in pib-db)
- Projects with multiple active workstreams that need querying
- Projects that also use the audit loop (findings can link to actions)

**What gets set up:**
- `pib.db` — SQLite database (created by `node scripts/pib-db.mjs init`)
- `scripts/pib-db.mjs` — CLI for create/query/close operations
- `scripts/pib-db-schema.sql` — Schema definition
- Orient `work-scan.md` phase — queries pib-db for open items
- Plan `work-tracker.md` phase — creates actions from plans
- Debrief `close-work.md` phase — marks items done

**Trade-offs:**
- Requires `better-sqlite3` npm dependency
- Work must be created via CC skills or the CLI
- No native web UI (though custom dashboards are possible)

**Cost:** 2-3 minutes to `npm install better-sqlite3` and initialize.

### Option B: Markdown File (tasks.md)

**What it is:** A single markdown file with checkbox task items and optional
metadata tags. No database, no schema, no dependencies. Work items are
lines in a file, checked off when done:

```markdown
## Active

- [ ] Build auth API <!-- area: backend -->
- [ ] Write docs for onboarding <!-- area: docs -->

## Done

- [x] Set up CI pipeline <!-- area: infra, completed: 2025-04-01 -->
```

Orient and debrief read and write by parsing the markdown file. Plans
append new items. Everything lives in git.

**Good for:**
- Projects that want all work in git (history, blame, review)
- Solo projects that want minimal tooling
- Projects that prefer reading work as a flat file
- Quick-start projects that might upgrade to pib-db later

**What gets set up:**
- `tasks.md` (or user-chosen name) — The task file
- Orient `work-scan.md` phase — parses tasks.md for open items
- Plan `work-tracker.md` phase — appends to tasks.md
- Debrief `close-work.md` phase — checks off completed items

**Trade-offs:**
- No semantic queries (orient must parse and sort in markdown)
- Concurrency issues if multiple agents write simultaneously
- Manual cleanup of old items (no soft-delete)
- Can't correlate work items with audit findings

**Cost:** Zero dependencies, instant setup.

### Option C: Bring Your Own

**What it is:** You already have a work tracker (GitHub Issues, Linear,
Jira, Notion, a spreadsheet). This phase doesn't create anything — it
records what system you use and wires orient/debrief/plan to reference it.

**Good for:**
- Teams with established tracking workflows
- Projects with complex workflows needing tool-specific integrations
- Systems that already have API access set up

**What gets set up:**
- Interview notes about the external system
- Placeholder phase files that reference your system:
  - Orient `work-scan.md` — example queries for your tracker
  - Plan `work-tracker.md` — example creation commands
  - Debrief `close-work.md` — example completion commands
- You customize the phase files to fit your specific system

## Presentation Format

Present options concisely, grounded in what the interview revealed:

```
## Work Tracking

Based on our conversation: [quote or reference from interview, or "you
haven't mentioned how you track work yet"]

I can set up one of three approaches:

**Option A: SQLite Database (pib-db)**
- Structured, queryable, local-only, no external services
- Best for: Multiple workstreams, plan→action pipeline, audit integration
- Cost: npm install + init (~2 min)

**Option B: Markdown File (tasks.md)**
- Simple, git-friendly, zero dependencies
- Best for: Solo projects, quick start, everything-in-git preference
- Cost: Zero, instant

**Option C: Your Existing System**
- Wire orient/debrief to GitHub Issues, Linear, Jira, etc.
- Best for: Teams with established workflows
- Cost: Customize phase files after onboard

Which approach fits your project? You can also skip work tracking for now.
```

## Recording the Choice

Record the choice in `.corrc.json` under a `workTracking` field:

```json
{
  "workTracking": {
    "choice": "pib-db"
  }
}
```

Or for markdown:
```json
{
  "workTracking": {
    "choice": "markdown",
    "file": "tasks.md"
  }
}
```

Or for external:
```json
{
  "workTracking": {
    "choice": "external",
    "system": "github-issues"
  }
}
```

Or if skipped:
```json
{
  "workTracking": {
    "choice": "none"
  }
}
```

## What Downstream Phases Do With This

### generate-briefing.md
Uses the choice to populate `_briefing.md`:
- pib-db: Documents CLI commands, DB location, query patterns
- markdown: Documents file location, format conventions
- external: Documents system name, access patterns
- none: Notes that work tracking is not configured

### generate-session-loop.md
Creates phase files appropriate to the choice:
- pib-db: work-scan queries the DB, close-work marks actions done
- markdown: work-scan parses the file, close-work checks off items
- external: scaffolds placeholder phases the user customizes
- none: no work-related phase files created

### modularity-menu.md
Reflects the choice in the module status table. If the user chose markdown,
the "Work Tracking" module shows as "ACTIVE (markdown)" not "NOT ADOPTED."

## Migration Path

If a user chose markdown initially and later wants to switch to pib-db:

1. Run `/onboard` again
2. Early re-run detects markdown tracking
3. Work-tracking phase asks: "Still using tasks.md? Anything missing?"
4. If user wants to upgrade: offer to import from markdown into pib-db
5. Update `.corrc.json` and regenerate phase files
