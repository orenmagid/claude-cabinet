---
name: onboard
description: |
  Assemble the cabinet. Interviews you about your project and prepares the
  briefings your cabinet members need to do their jobs — who you are, what
  you're building, where things live, what matters. Re-runnable as the
  project matures — each run refines based on what the project has learned.
  Use when: "onboard", "set up CC", "bootstrap", "/onboard".
related:
  - type: file
    path: .claude/skills/onboard/phases/detect-state.md
    role: "Detect existing CC artifacts and determine run mode"
  - type: file
    path: .claude/skills/onboard/phases/interview.md
    role: "Conversational interview questions"
  - type: file
    path: .claude/skills/onboard/phases/work-tracking.md
    role: "Choose work tracking system (SQLite vs markdown vs external)"
  - type: file
    path: .claude/skills/onboard/phases/options.md
    role: "Structured decision points before generation"
  - type: file
    path: .claude/skills/onboard/phases/generate-briefing.md
    role: "Generate or update briefing files"
  - type: file
    path: .claude/skills/onboard/phases/generate-session-loop.md
    role: "Wire orient/debrief phase files"
  - type: file
    path: .claude/skills/onboard/phases/modularity-menu.md
    role: "Present opt-in modules"
  - type: file
    path: .claude/skills/onboard/phases/summary.md
    role: "Present what was generated/changed"
  - type: file
    path: .claude/skills/onboard/phases/post-onboard-audit.md
    role: "Configuration sanity check after generation"
---

# /onboard — Assemble the Cabinet

## Purpose

Assemble the cabinet. Before your advisors can do their jobs, they need
briefings — who you are, what you're building, where things live, what
matters. Without briefings, the session loop runs blind: orient reads
files that don't exist, debrief records lessons into a structure that
hasn't been defined, plan looks for overlap in a work tracker that
hasn't been wired.

Onboard fills this gap through conversation, not mechanical config. It
interviews you about your project — like sitting down with a new hire
and walking them through how things work here. The answers become the
briefings your cabinet reads before every session. It's deliberately
conversational because the best briefing comes from the person who
lives with the project, not from scanning a directory tree.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration is generic — detect state, interview, generate files. Your
project customizes the specifics in phase files under `phases/`.

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

## Three Modes

Onboard is re-runnable. What it does depends on what already exists:

### 1. First Run (no _briefing.md)

No CC briefing layer exists yet. This is the full interview: who are you,
what is this, what breaks, what do you need. Generates the complete
initial briefing layer — `_briefing.md`, CLAUDE.md additions, system-status.md,
and session loop wiring. The goal is a working session loop by the end of
the conversation.

### 2. Early Re-Run (sparse artifacts)

Some CC artifacts exist but the project is young. The session loop has
run a few times and the user has learned what works and what doesn't.
The interview shifts to refinement: What has the session loop taught you
that CLAUDE.md doesn't reflect? What friction have you hit? What briefing
is missing that orient keeps needing? This mode proposes updates to
existing files rather than creating new ones.

### 3. Mature Re-Run (rich context)

The project has been using CC for a while. Briefing files are populated,
multiple modules are active, patterns have accumulated. The interview
becomes a health check: Which modules are you actually using? Is anything
ready to retire? What gaps have you noticed? Are there new areas the
system should cover? This mode may propose removing or simplifying things
as often as adding them.

The mode is detected automatically in the detect-state phase. The user
doesn't have to declare it.

## Why This Matters

Every CC skill reads from the briefing layer. Orient reads `_briefing.md`
to know what files to check. Plan reads it to know where work items live.
Cabinet members read it to know where to look. If the briefing layer is empty
or wrong, every skill downstream is degraded. Onboard is the foundation
pour — invisible when it's done right, catastrophic when it's missing.

The re-run capability matters because projects change. The briefing that
was accurate at day one drifts as the project grows, shifts direction, or
discovers new pain points. Onboard is not a one-time setup wizard — it is
the periodic recalibration that keeps the briefing layer honest.

## Workflow

### 1. Detect State

Read `phases/detect-state.md` for how to scan existing CC artifacts.

**Default (absent/empty):** Scan for the standard CC artifact set:
`_briefing.md`, `system-status.md`, `orient/phases/`, `debrief/phases/`,
`pib.db`, `committees.yaml`, `memory/patterns/`. Count what exists, classify
its richness (empty file vs populated), and determine the run mode. Report
findings so subsequent phases know whether they're generating, refining,
or health-checking.

In first-run mode, this phase is fast — almost nothing exists. In re-run
modes, it provides the inventory that the interview phase uses to ask
targeted questions.

### 2. Interview

Read `phases/interview.md` for the conversational questions adapted to
the detected mode.

**Default (absent/empty):**

In first-run mode, start with the foundational questions: What is this
project? What technology stack? Who works on it? What pain points led
you here? What breaks silently? What do you wish Claude knew about this
project from the start?

In early re-run mode, shift to refinement: What has the session loop
taught you that the briefing files don't capture? What does orient miss?
What does debrief fail to close? Where is there friction?

In mature re-run mode, shift to health: Which modules are you actually
using? Anything that felt useful at first but isn't anymore? Gaps you've
noticed in coverage? Any pain points that the system should have caught
by now?

This is a conversation, not a form. Ask 2-3 questions at a time, not all
at once. Follow up on answers — if the user mentions a pain point, dig
into it. If something sounds like it maps to a specific CC module, note
it for the modularity menu phase. The interview is the most valuable
phase because it captures knowledge that no amount of file scanning can
surface.

### 3. Work Tracking

Read `phases/work-tracking.md` for how to present work tracking options.

**Default (absent/empty):** Detect existing work tracking (pib.db,
tasks.md, GitHub Issues, custom phase files). Present two built-in
options — SQLite database (pib-db) or markdown file (tasks.md) — plus
bring-your-own for external systems. User picks one, the other, or
neither. The choice is recorded in `.corrc.json` under `workTracking`
and feeds into generate-briefing and generate-session-loop.

### 4. Options

Read `phases/options.md` for how to present structured decision points.

**Default (absent/empty):** If the interview revealed open decisions
(tech stack undecided, architecture unclear, "what would you recommend?"),
present 2-3 options per decision with trade-offs. Uses architecture and
boundary-man cabinet members internally to evaluate each option.
Skips automatically when the user already has clear opinions or this is
a re-run.

The user's choices feed into generate-briefing. Deferred decisions are
noted as open questions in `_briefing.md`.

### 5. Generate Briefing

Read `phases/generate-briefing.md` for how to create or update the briefing
layer from interview answers.

**Default (absent/empty):**

In first-run mode, generate:
- `_briefing.md` from the `_briefing-template.md` — populated with the
  project's identity, stack, principles, architecture, and scan scopes
- CLAUDE.md additions — project-specific instructions that Claude should
  always follow
- `system-status.md` — initial state tracking file

In re-run mode, propose specific updates to existing files. Show what
would change as diffs — never overwrite without showing the delta. Let
the user approve, modify, or reject each change. The user owns their
briefing files; onboard proposes, never imposes.

### 6. Generate Session Loop

Read `phases/generate-session-loop.md` for how to wire orient and debrief
phase files.

**Default (absent/empty):**

In first-run mode, create the minimal phase files that make the session
loop functional:
- `orient/phases/context.md` pointing at the files generated in step 5
- Any other orient phase files needed based on what the interview revealed
  (e.g., `data-sync.md` if the project has a remote data store)
- Debrief phase files if the interview revealed specific close-of-session
  needs

Reference existing skeleton defaults — only create phase files that need
to diverge from defaults. If the default behavior for a phase is already
correct for this project, don't create a file that restates the default.

In re-run mode, examine existing phase files and propose refinements based
on what the interview surfaced. If the user said "orient never shows me X,"
that's a signal to update the work-scan or health-checks phase.

### 7. Modularity Menu

Read `phases/modularity-menu.md` for which CC modules to present.

**Default (absent/empty):** Present the module hierarchy with adoption
recommendations based on the interview. The session loop is always set up.
Other modules are presented with clear descriptions of what they add and
what they cost in complexity. The user opts in to what makes sense now —
they can always add more later.

In re-run mode, show what's adopted alongside what's available. Surface
retirement candidates — modules that were adopted but aren't being used.

### 8. Summary

Read `phases/summary.md` for how to present results.

**Default (absent/empty):** Present what was generated or changed, what
was skipped, and what to do next. Emphasize progressive refinement: these
files are a starting point, not a finished product. They'll improve
through use as orient and debrief reveal what's missing.

In re-run mode, present a before/after view: what the briefing layer
looked like before, what changed, and why.

### 9. Post-Onboard Audit

Read `phases/post-onboard-audit.md` for the configuration sanity check.

**Default (absent/empty):** Run a lightweight audit from the cc-health
cabinet member, scoped to what was just generated. Checks interview–config
coherence (did mentioned technologies get wired into phase files?),
module–phase alignment (do phase files reference skipped modules?),
structural basics (do referenced files exist?), and first-session
readiness (will orient work on its first run?).

If everything checks out, one line: "Configuration looks clean." If
issues are found, present them and offer to fix immediately. This is a
pre-flight check, not a deferred finding.

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `detect-state.md` | Default: scan standard CC artifacts | What artifacts to scan and how to determine mode |
| `interview.md` | Default: mode-adapted questions | What to ask and how to follow up |
| `work-tracking.md` | Default: detect & present choices | What work tracking system to use (pib-db, markdown, or external) |
| `options.md` | Default: present decisions with trade-offs | What decisions to surface and how to frame options |
| `generate-briefing.md` | Default: create/update _briefing.md, CLAUDE.md, system-status.md | What files to generate and how |
| `generate-session-loop.md` | Default: wire orient/debrief phases | How to set up the session loop |
| `modularity-menu.md` | Default: present module hierarchy | Which modules to present and how |
| `summary.md` | Default: present changes + next steps | How to present results |
| `post-onboard-audit.md` | Default: cc-health sanity check | What to verify after generation |

## Conversational Stance

Onboard is a companion, not a configurator. The framing is "let's figure
out what your project needs" — not "I'll set up your system now." The
interview is genuine curiosity about the project, not a checklist to get
through. When the user describes a pain point, the right response is to
understand it, not to immediately map it to a CC module.

This matters because the quality of the briefing layer depends on the
quality of the conversation. A mechanical interview produces mechanical
briefing files. A genuine conversation about what the project needs, what
breaks, what matters — that produces briefing files worth reading.

Concrete stance markers:
- "Tell me about this project" not "Please provide your project description"
- "What breaks that nobody notices?" not "List your system's failure modes"
- "Based on what you've described, I think X would help because..." not
  "Module X is recommended for projects with these characteristics"
- Ask why, not just what. The reasoning behind a pain point often reveals
  the right response better than the symptom itself.

## Extending

To customize a phase: write content in the corresponding `phases/` file.
To skip a phase: write only `skip: true` in the file.
To add a phase the skeleton doesn't define: create a new file in
`phases/` with a description of when it runs relative to the core phases.

Examples of phases mature adopters add:
- Team onboarding (multi-person context: who knows what, communication norms)
- Migration import (pull context from an existing system being replaced)
- Integration discovery (scan for connected services, APIs, databases)
- Compliance baseline (capture regulatory or policy constraints upfront)

## Calibration

**Core failure this targets:** Starting CC adoption with empty context
files, causing the session loop to run without knowing anything about the
project it's supposed to help.

### Without Skill (Bad)

A project adopts CC. They copy the skeleton files, run `/orient` — it
reads a blank `_briefing.md` and an empty `system-status.md`, reports
nothing useful. They run `/debrief` — it tries to close work items but
doesn't know where work is tracked. They create a plan — cabinet members
activate but have no project briefing to ground their findings in. Every
skill technically runs but none of them know enough to be useful.

The user fills in briefing files manually, guessing at what sections
matter. They miss the scan scopes section entirely, so cabinet members
can't find the right directories. They write a project description that's
too abstract to be actionable. Three weeks later, they're still
discovering context gaps one at a time.

### With Skill (Good)

A project adopts CC and runs `/onboard`. The interview asks what the
project is, what stack it uses, what hurts. The user mentions they have a
Rails app with a PostgreSQL database, three developers, and a recurring
problem with stale feature flags. From the conversation, onboard generates
a `_briefing.md` with the right scan scopes, a `system-status.md` that
tracks feature flag freshness, and orient phase files that check the
database and flag stale flags at session start.

The session loop works from day one because it knows what to look at.
Two weeks later, the user runs `/onboard` again. "Orient is great but it
never mentions the deploy pipeline." Onboard proposes adding a
health-check phase for deploy status. The briefing layer grows from use,
not from guessing.
