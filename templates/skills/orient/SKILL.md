---
name: orient
description: |
  Session start orientation. Reads project state, syncs data, scans work
  items, runs health checks and maintenance, then presents a briefing so
  the session starts informed. This is a skeleton skill using the phases/
  directory pattern. Use when: session start, "orient", "what's the state",
  "/orient".
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
    path: .claude/skills/orient/phases/perspectives.md
    role: "Project-specific: which perspectives to activate"
  - type: file
    path: .claude/skills/perspectives/_context.md
    role: "Project identity and configuration"
---

# /orient — Session Orientation

## Purpose

Start every session with a clear picture of current state so the user
doesn't have to carry it in their head. Without orientation, Claude starts
blind — makes the same mistakes, asks the same questions, misses what
changed since last time. The session loop is the system's learning
mechanism: orient reads the past, debrief writes the future.

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

**Skip (absent/empty).** But note: without work scanning, orient can
only report on project state, not on what needs doing. This phase is
what connects orientation to action.

### 4. Health Checks (core)

Read `phases/health-checks.md` for system health and validation checks
to run at session start. These catch problems early — stale data, broken
references, failed background processes, configuration drift.

**Skip (absent/empty).** Projects add health checks as they discover
failure modes worth detecting early.

> **Orient vs Pulse vs Audit:** Orient health checks verify *operational*
> state — is the system running, is data fresh, are processes alive?
> Pulse (embedded in orient) verifies *descriptive* accuracy — do counts
> match, do documented states match reality? Audit verifies *quality*
> through expert perspectives — is the code sound, are conventions
> holding? Orient runs every session; pulse runs inside it; audit runs
> periodically. Each asks a different question about the same system.

### 5. Auto-Maintenance (core)

Read `phases/auto-maintenance.md` for recurring automated tasks that
should run every session. These are operations that would decay if left
to human memory — the anti-entropy principle in action.

**Skip (absent/empty).** Projects add maintenance tasks as they discover
operations that need regular execution but aren't worth remembering to
invoke manually.

### 6. Activate Perspectives (core)

Read `phases/perspectives.md` for which expert perspectives or lenses
should be active during this session. Perspectives watch for specific
concerns (quality, security, process adherence, non-project items)
without being explicitly invoked for each decision.

**Skip (absent/empty).**

### 7. Present Briefing (presentation)

Read `phases/briefing.md` for how to present the orientation results.
This phase controls format, sections, tone, and any time-aware or
context-aware presentation modes.

**Default (absent/empty):** Present a simple summary of what was gathered
in steps 1-6: project state, work items needing attention, any health
issues found, maintenance results.

### 8. Discover Custom Phases

After running the core phases above, check for any additional phase
files in `phases/` that the skeleton doesn't define. These are project-
specific extensions. Each custom phase file declares its position in the
workflow (e.g., "runs after work scan, before briefing"). Execute them
at their declared position.

### 9. Name the Session

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
| `work-scan.md` | Skip | What work items to check |
| `health-checks.md` | Skip | System health checks |
| `auto-maintenance.md` | Skip | Recurring session-start tasks |
| `perspectives.md` | Skip | Which perspectives to activate |
| `briefing.md` | Default: simple summary | How to present orientation |

## Quick Mode

Phases are either **core** (maintain system state) or **presentation**
(surface information for the user). For lightweight sessions where the
user already knows what they're doing, skip presentation phases. Core
phases always run because they keep the system healthy.

- **Core phases** (always run): context, data-sync, work-scan,
  health-checks, auto-maintenance, perspectives
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
- Time-aware briefing modes (morning briefing vs. standard session)
- Proactive skill suggestions (surface tools relevant to current state)
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
