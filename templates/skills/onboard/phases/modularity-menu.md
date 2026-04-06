# Modularity Menu — Present Opt-In Modules

Present the Claude Cabinet module hierarchy so the user can decide what to adopt now
and what to defer. The session loop is mandatory; everything else is
opt-in. Progressive adoption means starting with what you need and adding
modules as the project matures.

When this file is absent or empty, the default behavior is: read
`.corrc.json` for module selections made during CLI install, then present
the module hierarchy with that context. To explicitly skip the menu,
write only `skip: true`.

## Reading CLI Selections (.corrc.json)

If `.corrc.json` exists in the project root, the CLI has already asked
about module selections. Read the `modules` and `skipped` fields:

- **Installed modules** (`modules` map, value `true`): These are already
  set up. Don't re-ask. Confirm what's installed and move on.
- **Skipped modules** (`skipped` map, with reasons): The user opted out
  during CLI install. The reason matters — it tells you what alternative
  to ask about. For example:
  - `"work-tracking": "User has existing Railway API"` → ask how they
    track work so you can wire phase files to their system
  - `"work-tracking": "Not needed yet"` → note it's available later, move on
  - `"audit": "Project too small"` → respect the decision, note the threshold

For skipped modules with alternatives, the interview (previous phase)
should have already asked about the alternative system. Use those answers
here to confirm the wiring plan.

If `.corrc.json` doesn't exist (manual install or pre-npm adoption),
fall back to presenting the full menu as described below.

## Module Hierarchy

Present these in order from most fundamental to most specialized:

### 1. Session Loop (orient + debrief) — MANDATORY

Always set up. This is the minimum viable CoR adoption. Orient reads
state at session start; debrief writes state at session end. Without
this, nothing else has a foundation.

**What you get:** Context continuity between sessions. Claude starts
informed and ends by recording what happened. The project gets smarter
with each session instead of resetting to zero.

**Cost:** Two phase directories with a few files each. Runs at the
start and end of every session (adds 30-60 seconds each).

### 2. Work Tracking — RECOMMENDED

How work items are tracked. The work-tracking onboard phase presents the
options in detail; this is the module-level view.

**Options (chosen during onboard work-tracking phase):**
- **pib-db (SQLite):** Structured, queryable, local-only. CLI interface.
  Integrates with plan/execute and audit findings. Requires `better-sqlite3`.
- **Markdown (tasks.md):** Simple, git-friendly, zero dependencies. Open
  items are checkbox lines in a file. Good for solo/quick-start projects.
- **External:** Wire orient/debrief to GitHub Issues, Linear, Jira, etc.
  You customize phase files after onboard.

**What you get:** Open actions, due dates, flagged items. Orient surfaces
what needs attention. Debrief marks things done. Plan creates work items.

**Skip if:** You don't need work tracking in the session loop. You can
always add it later by re-running `/onboard`.

### 3. Planning (plan + execute) — OPT-IN

Structured implementation planning with cabinet member-based critique and
execution with checkpoints.

**What you get:** Plans that carry enough detail for a future session to
execute without re-exploring the codebase. Cabinet member agents that
critique plans before execution. Execution with structured checkpoints.

**Cost:** Plan and execute skill configuration. Cabinet member setup if you
want critique. Adds deliberation time before building — this is the point.

**Skip if:** Your project's work is mostly small, clear tasks that don't
benefit from structured planning. Add this module when you start hitting
edge cases or duplicating work.

### 4. Compliance Stack (rules, hooks) — OPT-IN

Scoped instructions in `.claude/rules/` and deterministic enforcement
via hooks in `.claude/settings.json`.

**What you get:** Path-specific rules that load automatically (e.g.,
"when editing tests/, always run the test suite"). Hooks that enforce
hard guardrails (e.g., block commits without tests, validate file formats).

**Cost:** Rule files and hook scripts that need maintenance. Hooks run on
every tool invocation — poorly written hooks add latency.

**Skip if:** Your project doesn't yet have recurring mistakes worth
encoding. Add rules as patterns emerge from debrief lessons.

### 5. Audit Loop (audit + triage-audit + cabinet members) — OPT-IN

Periodic cabinet member analysis of the codebase with structured
triage of findings.

**What you get:** Semantic analysis by specialized cabinet members (security,
accessibility, data integrity, etc.). Structured findings with severity
levels. Triage workflow to accept, defer, or dismiss findings.

**Cost:** Cabinet member configuration, audit runs (LLM-intensive), triage
time. This is the most expensive module in compute and attention.

**Skip if:** Your project is small enough to review holistically, or
you're not yet at the stage where systematic quality analysis adds value.
Add this when the codebase grows beyond what one person can hold in their
head.

### 6. Capability Seeding (seed) — OPT-IN

Bootstrap new skills, cabinet members, or process components from CoR
skeleton templates.

**What you get:** Quick scaffolding of new capabilities with all required
files and wiring in place.

**Cost:** Minimal. This is tooling for extending the system itself.

**Skip if:** You're happy with the modules you have and aren't planning
to build custom skills or cabinet members. Come back to this when you want
to extend.

## Presentation Guidelines

- **Present the full menu** so the user sees the landscape, but recommend
  based on what the interview revealed.
- **Mark the mandatory module** clearly — the session loop isn't optional.
- **Connect modules to pain points.** If the user mentioned stale deploys,
  note that health checks (part of the session loop) address this. If they
  mentioned duplicated work, note that the planning module helps.
- **Respect "not yet."** Deferring a module is fine. The menu is always
  available via re-running onboard.

## Re-Run Presentation

For re-runs, augment the menu with current adoption state:

```
Module                  Status          Notes
Session loop            ACTIVE          3 orient phases, 2 debrief phases
Work tracking           ACTIVE          47 actions, 8 projects
Planning                ACTIVE          Using plan + execute
Compliance stack        PARTIAL         2 rules files, no hooks
Audit loop              NOT ADOPTED     —
Capability seeding      NOT ADOPTED     —
```

Also surface:
- **Retirement candidates:** Modules or phase files that show signs of
  disuse (e.g., a health check that hasn't fired in weeks)
- **Growth candidates:** Modules the project seems ready for based on
  accumulated patterns or interview answers
