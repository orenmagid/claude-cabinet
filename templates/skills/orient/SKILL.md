---
name: orient
description: |
  Session briefing. Reads project state, syncs data, scans work items,
  runs health checks, then briefs you so the session starts informed.
  This is a skeleton skill using the phases/ directory pattern. Use when:
  session start, "orient", "what's the state", "/orient", "quick orient",
  "orient-quick", "/orient-quick". If "quick" is mentioned, use the Quick
  Mode section — run core phases only, skip presentation phases.
related:
  - type: file
    path: .claude/skills/orient/phases/context.md
    role: "Project-specific: what to read at session start"
  - type: file
    path: .claude/skills/orient/phases/data-sync.md
    role: "Project-specific: how to sync fresh data"
  - type: file
    path: .claude/skills/orient/phases/work-scan.md
    role: "Project-specific: what work items to check"
  - type: file
    path: .claude/skills/orient/phases/health-checks.md
    role: "Project-specific: system health checks"
  - type: file
    path: .claude/skills/orient/phases/auto-maintenance.md
    role: "Project-specific: recurring session-start tasks"
  - type: file
    path: .claude/skills/orient/phases/briefing.md
    role: "Project-specific: how to present the orientation"
  - type: file
    path: .claude/skills/orient/phases/cabinet.md
    role: "Project-specific: which cabinet members to activate"
  - type: file
    path: .claude/skills/orient/phases/skills-menu.md
    role: "Project-specific: what skills to show after briefing"
  - type: file
    path: cabinet/_briefing.md
    role: "Project identity and configuration"
---

# /orient — Session Briefing

## Purpose

Start every session with a briefing. Before anyone makes a decision,
assemble what happened since last time, what needs attention, and what's
on the agenda. Without this, Claude starts every session blind — same
mistakes, same questions, same missed context. Orient reads the past so
debrief can write the future. That's the loop that gives your cabinet
continuity.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration (what to do and in what order) is generic. Your project
defines the specifics — what files to read, what data to sync, what work
items to check — in phase files under `phases/`.

### Phase File Protocol

Phase files have three states:

| State | Meaning |
|-------|---------|
| Absent or empty | Use this skeleton's **default behavior** for the phase |
| Contains only `skip: true` | **Explicitly opted out** — skip this phase entirely |
| Contains content | **Custom behavior** — use the file's content instead |

The skeleton always does something reasonable when a phase file is absent.
Phase files customize, not enable. Use `skip: true` when you actively
don't want a phase to run — not even the default.

## Why This Matters

If Claude Code starts a session without reading what happened last time,
it has no memory. If it ends a session without recording what happened,
the next session starts blind. Orient doesn't need to be complex — a
minimal orient reads a project description and a status file. A mature
orient pulls fresh data, checks queues, evaluates health, and surfaces
what needs attention. The complexity grows from use: each check gets
added because its absence caused a problem. But the loop itself must
exist from day one, or nothing that follows has a foundation.

## Workflow

### 1. Load Context (core)

Read `phases/context.md` for the list of files and state to load at
session start. This typically includes status files, memory from prior
sessions, and project-specific context.

**Default (absent/empty):** Read at minimum:
- The project's root `CLAUDE.md` (already loaded by Claude Code)
- `system-status.md` or equivalent state file if one exists
- `.claude/memory/patterns/` — enforcement patterns from prior sessions.
  Scan the directory, read each pattern file. These are project-level
  feedback that guides behavior (what to avoid, what to keep doing).
- **Omega semantic memory** — omega's native SessionStart hook
  automatically surfaces recalled memories. During orient, query for
  additional project-scoped context via the adapter:
  ```bash
  echo '{"text": "session context project status recent decisions", "limit": 10}' | \
    ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py query
  ```
  Surface any relevant memories (decisions, lessons, constraints) that
  inform the current session. If omega is unavailable, run `omega hooks
  doctor` to diagnose. If the venv is missing but `.ccrc.json` lists
  the memory module as installed, warn the user:
  > ⚠ Memory module is installed but omega venv is missing.
  > Run `npx create-claude-cabinet` to restore it.

The goal: build a mental model of where things stand before doing
anything else.

### 2. Sync Data (core)

Read `phases/data-sync.md` for how to pull fresh canonical data from
remote sources (databases, APIs, shared storage).

**Skip (absent/empty).** Purely local projects don't need it. Projects
with remote canonical data stores define their sync commands here.

Report if sync fails — a stale local cache is better than no data, but
the user should know it's stale.

### 3. Scan Work Items (core)

Read `phases/work-scan.md` for what work items to check. This includes
whatever the project uses to track work: a backlog, task list, inbox,
queue, or issue tracker.

**Default (absent/empty):** If `scripts/pib-db.mjs` exists, run the
standard work scan:

1. **Active projects and open actions:**
   ```bash
   node scripts/pib-db.mjs query "
     SELECT p.fid, p.name,
       (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid AND a.completed = 0 AND a.deleted_at IS NULL) as open_actions
     FROM projects p
     WHERE p.status = 'active' AND p.deleted_at IS NULL
     ORDER BY open_actions DESC
   "
   ```

2. **Flagged actions** (prioritized items needing attention):
   ```bash
   node scripts/pib-db.mjs query "
     SELECT a.fid, a.text, p.name as project
     FROM actions a
     LEFT JOIN projects p ON a.project_fid = p.fid
     WHERE a.flagged = 1 AND a.completed = 0 AND a.deleted_at IS NULL
   "
   ```

3. **Staleness detection** — flag projects that need attention:

   **Completion candidates** — active projects where all actions are done:
   ```bash
   node scripts/pib-db.mjs query "
     SELECT p.fid, p.name
     FROM projects p
     WHERE p.status = 'active' AND p.deleted_at IS NULL
       AND (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid) > 0
       AND (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid AND a.completed = 0 AND a.deleted_at IS NULL) = 0
   "
   ```

   **Stale projects** — active projects with no action completed in 14+ days:
   ```bash
   node scripts/pib-db.mjs query "
     SELECT p.fid, p.name,
       MAX(a.completed_at) as last_completion
     FROM projects p
     LEFT JOIN actions a ON a.project_fid = p.fid AND a.completed = 1
     WHERE p.status = 'active' AND p.deleted_at IS NULL
       AND (SELECT COUNT(*) FROM actions a2 WHERE a2.project_fid = p.fid AND a2.completed = 0 AND a2.deleted_at IS NULL) > 0
     GROUP BY p.fid
     HAVING last_completion < date('now', '-14 days')
       OR last_completion IS NULL
   "
   ```

   Surface in briefing as actionable signals:
   - "N projects may be ready to close (0 open actions)"
   - "N projects have had no activity in 14+ days"

If pib-db doesn't exist, skip with no warning — the project may use
a different work tracking system configured in `phases/work-scan.md`.

### 4. Health Checks (core)

Read `phases/health-checks.md` for system health and validation checks
to run at session start. These catch problems early — stale data, broken
references, failed background processes, configuration drift.

**Skip (absent/empty).** Projects add health checks as they discover
failure modes worth detecting early.

**Built-in check (always runs):** If `~/.claude/cc-registry.json`
exists, verify this project is in it and the entry is current. If
other registry entries point to paths that no longer exist, silently
note it — mention during briefing only if the user might care (e.g.,
"Your old project 'deal-v1' seems to have been deleted — want me to
remove it from the registry?").

> **Orient vs Pulse vs Audit:** Orient health checks verify *operational*
> state — is the system running, is data fresh, are processes alive?
> Pulse (embedded in orient) verifies *descriptive* accuracy — do counts
> match, do documented states match reality? Audit verifies *quality*
> through expert cabinet members — is the code sound, are conventions
> holding? Orient runs every session; pulse runs inside it; audit runs
> periodically. Each asks a different question about the same system.

### 5. Auto-Maintenance (core)

Read `phases/auto-maintenance.md` for recurring automated tasks that
should run every session. These are operations that would decay if left
to human memory — the anti-entropy principle in action.

**Default (absent/empty):** If omega is active (`~/.claude-cabinet/omega-venv/bin/omega`
exists), run memory hygiene: `omega consolidate` every session (prune stale,
dedup), `omega compact` weekly (cluster similar memories), `omega backup`
weekly. Projects add additional maintenance tasks as they discover operations
that need regular execution.

### 6. Activate Cabinet Members (core)

Read `phases/cabinet.md` for which expert cabinet members or lenses
should be active during this session. Cabinet members watch for specific
concerns (quality, security, process adherence, non-project items)
without being explicitly invoked for each decision.

**Skip (absent/empty).**

### 7. Cabinet Consultations (core)

Spawn cabinet members whose `standing-mandate` includes `orient`.

**Discovery:** Read `.claude/skills/_index.json` and filter to entries
where `standingMandate` includes `"orient"`. Each matching entry has
a `directives.orient` field — this is the scoped task for that member.
If the index is missing, fall back to reading `cabinet-*/SKILL.md`
frontmatter for `standing-mandate` and `directives`.

**For each matching member**, spawn an agent with:
- The member's full SKILL.md (read from the `path` in the index)
- The context loaded in step 1 (project state, recent work)
- The member's `directives.orient` as the task

Spawn in parallel where possible. If a member has no directive for
`orient`, skip it — a standing mandate without a directive is a data
error, not a reason to give the member an open-ended task.

**Cost control:** These are lightweight passes, not full audits. Each
agent should complete in under 1 minute. Include their output in the
briefing only when they have something to contribute. Silent is fine.

### 8. Present Briefing (presentation)

Read `phases/briefing.md` for how to present the orientation results.
This phase controls format, sections, tone, and any time-aware or
context-aware presentation modes.

**Default (absent/empty):** Present a structured briefing with these
required sections in this order:

1. **Project State** — version, what's active, high-level status
2. **Work Items** — active projects, open action counts, flagged/overdue
   items listed explicitly
3. **Attention Items** — anything surfaced by health checks, feedback
   reports, extraction proposals, stale/completable projects
4. **Maintenance** — omega consolidation results, any weekly tasks run
5. **Cabinet Notes** — output from cabinet consultations (only if they
   had something to say)

Keep sections consistent across sessions. Omit a section only if it
has literally nothing to report (not "nothing interesting" — nothing
at all). Use the same section names and order every time.

### 9. Show Available Skills (core)

After the briefing, show the user what skills are available. This
serves the same purpose as a menu at a restaurant — you can't order
what you don't know exists.

**Default (absent/empty):** Invoke the `/menu` skill. This dynamically
discovers all skills in `.claude/skills/` (both CC upstream and project-
specific), reads their frontmatter, and presents them grouped by
auto-invocable vs manual. It also suggests which skills are most
relevant given current context.

Read `phases/skills-menu.md` for project-specific overrides (e.g.,
highlighting certain skills, suppressing others, or changing the
presentation format).

### 10. Discover Custom Phases

After running the core phases above, check for any additional phase
files in `phases/` that the skeleton doesn't define. These are project-
specific extensions. Each custom phase file declares its position in the
workflow (e.g., "runs after work scan, before briefing"). Execute them
at their declared position.

### 11. Name the Session

Rename the session so the sidebar is scannable. Every session that starts
with `/orient` looks identical in the history — naming fixes this.

After the briefing and the user's response, derive a short name (3-6
words) from what the user says they're working on. If the user hasn't
stated a focus, ask.

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `context.md` | Default: read CLAUDE.md, status, memory | What files and state to load |
| `data-sync.md` | Skip | How to sync remote data |
| `work-scan.md` | Default: pib-db scan + staleness detection | What work items to check |
| `health-checks.md` | Skip | System health checks |
| `auto-maintenance.md` | Default: omega memory hygiene | Recurring session-start tasks |
| `cabinet.md` | Skip | Which cabinet members to activate |
| `briefing.md` | Default: simple summary | How to present orientation |
| `skills-menu.md` | Default: invoke /menu | What skills to show and how |

## Quick Mode

Phases are either **core** (maintain system state) or **presentation**
(surface information for the user). For lightweight sessions where the
user already knows what they're doing, skip presentation phases. Core
phases always run because they keep the system healthy.

- **Core phases** (always run): context, data-sync, work-scan,
  health-checks, auto-maintenance, cabinet, cabinet-consultations,
  skills-menu
- **Presentation phases** (skippable): briefing

A project that wants a quick orient variant skips the briefing phase
and outputs a one-line confirmation instead.

## Extending

To customize a phase: write content in the corresponding `phases/` file.
To skip a phase: leave the file empty or don't create it.
To add a phase the skeleton doesn't define: create a new file in
`phases/` with a description of when it runs relative to the core
phases. Claude reads whatever phase files exist at runtime.

Examples of phases mature projects add:
- Command queue processing (check for instructions from external UIs)
- Deferred item evaluation (re-check trigger conditions on paused work)
- Time-aware briefing modes (first session of day vs. returning session)
- Calendar integration (upcoming events that need preparation)

## Calibration

**Core failure this targets:** Starting a session without context, forcing
the user to reconstruct state from memory or ask for information the
system already has.

### Without Skill (Bad)

New session starts. Claude says "How can I help?" The user asks about
their project status — Claude searches files, reads logs, gives a partial
picture. The user asks about pending tasks — Claude queries again. The
user mentions something from last session — Claude has no memory of it.

Three round trips to assemble context that one orientation would have
surfaced. Meanwhile, an overdue deadline sits unmentioned because nobody
asked about it.

### With Skill (Good)

New session starts. Claude loads project state, syncs fresh data, scans
the work backlog, and presents: here's where things stand, here's what
needs attention, here's what changed since last time. The overdue item
is surfaced before the user has to remember it. One message, full
picture. The user decides what to work on from an informed position.
