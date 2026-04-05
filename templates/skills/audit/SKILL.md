---
model: opus
name: audit
description: |
  Systematic quality audit. Selects perspectives, loads triage suppression,
  spawns parallel perspective agents, merges findings, and persists results.
  The audit is the system's learning mechanism for drift and quality gaps
  that accumulate silently between sessions. Use when: "audit", "run an
  audit", "/audit", scheduled audit trigger, or significant milestone.
related:
  - type: file
    path: .claude/skills/audit/phases/perspective-selection.md
    role: "Project-specific: which perspectives to run"
  - type: file
    path: .claude/skills/audit/phases/structural-checks.md
    role: "Project-specific: fast structural checks before full audit"
  - type: file
    path: .claude/skills/audit/phases/triage-history.md
    role: "Project-specific: how to load suppression lists"
  - type: file
    path: .claude/skills/audit/phases/perspective-execution.md
    role: "Project-specific: how to run perspective agents"
  - type: file
    path: .claude/skills/audit/phases/finding-output.md
    role: "Project-specific: how to persist and report findings"
  - type: file
    path: .claude/skills/perspectives/output-contract.md
    role: "How perspectives produce structured findings"
  - type: file
    path: .claude/skills/perspectives/_context.md
    role: "Project identity and configuration"
  - type: file
    path: scripts/finding-schema.json
    role: "JSON Schema for finding validation"
  - type: file
    path: scripts/merge-findings.js
    role: "Merges per-perspective JSON into run-summary.json"
  - type: file
    path: scripts/load-triage-history.js
    role: "Builds suppression lists from triage history"
  - type: file
    path: scripts/pib-db.js
    role: "Reference data layer for finding persistence"
---

# /audit — Systematic Quality Audit

## Purpose

Surface drift, convention violations, and quality gaps that no single
session introduced. Without audit, the only learning channel is friction
the user notices during active work. But some problems accumulate silently
— a convention erodes across ten commits, a subsystem degrades gradually,
an architectural decision's consequences only become visible at scale.
The audit catches what individual sessions miss.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration (what to do and in what order) is generic. Your project
defines the specifics — which perspectives to run, what fast checks to
apply, how to persist findings — in phase files under `phases/`.

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

## Identity

You are the auditor. You don't build — you observe, reason, and propose.
Your job is to surface what the system's daily operators can't see because
they're inside it. You approach the codebase as an outsider with fresh
eyes, checking whether what the system claims to be matches what it
actually is.

You are not a linter. You don't flag style violations or enforce
arbitrary standards. You use expert perspectives — named lenses that
each bring domain knowledge and specific concerns. A perspective on
accessibility looks at the UI differently than a perspective on data
integrity looks at the persistence layer. The combination of
perspectives produces a holistic picture that no single viewpoint
could achieve.

Your findings are suggestions. Every one goes through triage where the
user confirms, defers, or rejects it. A high rejection rate means your
calibration is off — you're flagging things that don't matter to this
project. Adjust.

## When to Run

- On a schedule (weekly, after milestones, before releases)
- When the user asks for an audit
- After significant architectural changes
- When a new perspective is adopted (run it once to establish baseline)

## Workflow

### 1. Select Perspectives (core)

Read `phases/perspective-selection.md` for which perspectives to run.

**Default (absent/empty):** Discover all perspectives from
`skills/perspectives/*/SKILL.md`. If `skills/perspectives/_groups.yaml`
exists (copied from `_groups-template.yaml`), present groups and let the
user choose which to run. If no groups file exists, run all discovered
perspectives.

The selection determines what the audit looks at. A full audit runs
everything; a focused audit runs one group or a specific set of
perspectives.

### 2. Fast Structural Checks (core)

Read `phases/structural-checks.md` for fast, deterministic checks to run before
the full perspective-based audit. These are things like linters, type
checkers, validation scripts — anything that gives immediate signal
without AI interpretation.

**Skip (absent/empty).** Most projects start without structural checks
and add them as they discover invariants worth verifying automatically.
Structural checks are an optimization, not a prerequisite.

### 3. Load Triage Suppression (core)

Read `phases/triage-history.md` for how to build the suppression list
of previously-triaged findings.

**Default (absent/empty):** Run `scripts/load-triage-history.js` to
build suppression lists. This script tries the reference data layer
(pib-db) first, then falls back to scanning `reviews/*/triage.json`
files. The result is a JSON object with rejected and deferred finding
IDs and fingerprints.

Pass the suppression list to each perspective agent so they skip
findings that were already rejected or deferred. Without suppression,
every audit regenerates the same findings the user already dismissed,
and the triage queue becomes useless.

### 4. Execute Perspective Agents (core)

Read `phases/perspective-execution.md` for how to spawn and manage
perspective agents.

**Default (absent/empty):** For each selected perspective:
1. Read the perspective's `SKILL.md` for domain knowledge and concerns
2. Read `skills/perspectives/_context.md` for project identity
3. Read `skills/perspectives/output-contract.md` for output format
4. Pass the suppression list from step 3
5. Spawn as an agent (parallel when possible)

Each perspective agent follows a two-phase protocol:
- **Phase A — Explore:** Read broadly, examine the codebase through this
  perspective's lens. Take notes on everything observed.
- **Phase B — Rank and emit:** From everything observed, select the top
  5-8 findings that matter most. Apply the output contract. Emit JSON.

The two-phase protocol prevents premature commitment — the perspective
sees everything before deciding what to report. Without it, the first
interesting thing found dominates the output.

### 5. Merge and Persist Findings (core)

Read `phases/finding-output.md` for how to persist and report the
audit results.

**Default (absent/empty):**
1. Create a timestamped run directory: `reviews/YYYY-MM-DD/HH-MM-SS/`
2. Write each perspective's JSON output to the run directory
3. Run `scripts/merge-findings.js <run-dir>` to produce `run-summary.json`
4. Run `scripts/merge-findings.js <run-dir> --db` to also ingest into
   the reference data layer (if pib-db is initialized)
5. Present findings summary: total count, breakdown by severity, by
   perspective, and highlight any critical findings

After persisting, remind the user about triage: findings need human
judgment before they drive action. Use `/triage-audit` to review and
decide on findings.

### 6. Discover Custom Phases

After running the core phases above, check for any additional phase
files in `phases/` that the skeleton doesn't define. These are project-
specific extensions. Each custom phase file declares its position in
the workflow. Execute them at their declared position.

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `perspective-selection.md` | Default: discover all, present groups if available | Which perspectives to run |
| `structural-checks.md` | Skip | Fast structural checks before full audit |
| `triage-history.md` | Default: run load-triage-history.js | How to load suppression lists |
| `perspective-execution.md` | Default: parallel agents with two-phase protocol | How to run perspective agents |
| `finding-output.md` | Default: timestamped dir + merge + pib-db ingest | How to persist and report findings |

## How Audit Connects to Other Skills

**Orient** verifies operational state — is the system running, is data
fresh, are processes alive? **Audit** verifies quality and alignment —
does the system do what it claims, is it drifting, are conventions
holding? Orient runs every session; audit runs periodically or on
demand.

**Debrief** captures session-specific lessons — what was learned during
this work session. **Audit** captures systematic observations from
expert perspectives — what would a specialist notice? Debrief lessons
come from doing; audit findings come from looking.

**Triage-audit** is the audit's partner. Audit generates findings;
triage presents them for human judgment. Without triage, findings
accumulate and are never acted on. Without audit, triage has nothing
to triage. They form a closed loop.

**Pulse** watches self-description accuracy — do counts match, do
documented states match reality? Audit watches quality through domain
expert lenses. Pulse is fast and embedded; audit is thorough and
standalone.

## Extending

To customize a phase: write content in the corresponding `phases/` file.
To skip a phase: write only `skip: true` in the file.
To add a phase the skeleton doesn't define: create a new file in
`phases/` with a description of when it runs relative to the core
phases. Claude reads whatever phase files exist at runtime.

Examples of phases mature projects add:
- Auto-fix execution (attempt fixes for autoFixable findings after triage)
- Trend analysis (compare this run to previous runs for improvement/regression)
- Notification (alert external systems when critical findings appear)
- Perspective evaluation (track which perspectives consistently produce
  useful findings vs noise)

## Calibration

**Core failure this targets:** Quality drift that accumulates silently
between sessions because no one is systematically looking for it.

### Without Skill (Bad)

The project grows over months. Conventions established early erode as
new code ignores them. A subsystem that worked at small scale starts
showing strain. An architectural decision's consequences become visible
only when the tenth module follows the same broken pattern. No one
notices because each session focuses on the task at hand, not on the
whole.

Six months later, a refactoring effort reveals a dozen intertwined
issues that could have been caught individually. The cost of fixing
them all at once is 10x what incremental fixes would have been.

### With Skill (Good)

Every two weeks, the audit runs. Perspective agents examine the codebase
through different lenses — architecture, code quality, UX, security,
process adherence. Findings go through triage: the user fixes what
matters, defers what can wait, rejects what's noise. Each perspective
learns from rejections (calibration drift). Conventions stay enforced
because someone is checking. Drift is caught at one commit, not ten.

The system maintains quality not through heroic effort but through
regular, structured observation.
