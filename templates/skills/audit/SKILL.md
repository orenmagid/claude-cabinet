---
model: opus
name: audit
description: |
  Convene the full cabinet for a quality review. Each cabinet member examines
  the project from their domain — security, performance, accessibility, and
  so on — and reports what they find. Like calling a cabinet meeting where
  every advisor reviews the state of things and flags what needs attention.
  Use when: "audit", "run an audit", "/audit", scheduled audit trigger,
  or significant milestone.
related:
  - type: file
    path: .claude/skills/audit/phases/member-selection.md
    role: "Project-specific: which cabinet members to run"
  - type: file
    path: .claude/skills/audit/phases/structural-checks.md
    role: "Project-specific: fast structural checks before full audit"
  - type: file
    path: .claude/skills/audit/phases/triage-history.md
    role: "Project-specific: how to load suppression lists"
  - type: file
    path: .claude/skills/audit/phases/member-execution.md
    role: "Project-specific: how to run cabinet member agents"
  - type: file
    path: .claude/skills/audit/phases/finding-output.md
    role: "Project-specific: how to persist and report findings"
  - type: file
    path: cabinet/output-contract.md
    role: "How cabinet members report their findings"
  - type: file
    path: cabinet/_briefing.md
    role: "Project identity and configuration"
  - type: file
    path: scripts/finding-schema.json
    role: "JSON Schema for finding validation"
  - type: file
    path: scripts/merge-findings.js
    role: "Merges per-member JSON into run-summary.json"
  - type: file
    path: scripts/load-triage-history.js
    role: "Builds suppression lists from triage history"
  - type: file
    path: scripts/pib-db.js
    role: "Reference data layer for finding persistence"
---

# /audit — Convene the Cabinet

## Purpose

Call a full cabinet meeting. Every cabinet member examines the project
from their domain and reports what they find — the way a board of
advisors would review the state of operations. Without this, the only
learning channel is friction the user notices during active work. But
some problems accumulate silently — a convention erodes across ten
commits, a subsystem degrades gradually, an architectural decision's
consequences only become visible at scale.
The audit catches what individual sessions miss.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration (what to do and in what order) is generic. Your project
defines the specifics — which cabinet members to run, what fast checks to
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
arbitrary standards. You use cabinet members — named lenses that
each bring domain knowledge and specific concerns. A cabinet member on
accessibility looks at the UI differently than a cabinet member on data
integrity looks at the persistence layer. The combination of
cabinet members produces a holistic picture that no single viewpoint
could achieve.

Your findings are suggestions. Every one goes through triage where the
user confirms, defers, or rejects it. A high rejection rate means your
calibration is off — you're flagging things that don't matter to this
project. Adjust.

## When to Run

- On a schedule (weekly, after milestones, before releases)
- When the user asks for an audit
- After significant architectural changes
- When a new cabinet member is adopted (run it once to establish baseline)

## Workflow

### 1. Select Cabinet Members (core)

Read `phases/member-selection.md` for which cabinet members to run.

**Default (absent/empty):** Discover all cabinet members from
`skills/cabinet-*/SKILL.md`. Run `node scripts/resolve-committees.js` to
get the merged committee list (upstream `cabinet/committees.yaml` merged
with project `cabinet/committees-project.yaml`). Present the merged
committees and let the user choose which to run. If neither committees
file exists, run all discovered cabinet members.

Cross-portfolio cabinet members (anti-confirmation, qa, debugger,
organized-mind) always run regardless of committee selection — they
activate via `standing-mandate` in their SKILL.md frontmatter.

The selection determines what the audit looks at. A full audit runs
everything; a focused audit runs one committee or a specific set of
cabinet members.

### 2. Fast Structural Checks (core)

Read `phases/structural-checks.md` for fast, deterministic checks to run before
the full cabinet member-based audit. These are things like linters, type
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

Pass the suppression list to each cabinet member agent so they skip
findings that were already rejected or deferred. Without suppression,
every audit regenerates the same findings the user already dismissed,
and the triage queue becomes useless.

### 4. Execute Cabinet Member Agents (core)

Read `phases/member-execution.md` for how to spawn and manage
cabinet member agents.

**Default (absent/empty):** For each selected cabinet member:
1. Read the cabinet member's `SKILL.md` for domain knowledge and concerns
2. Read `cabinet/_briefing.md` for project identity
3. Read `cabinet/output-contract.md` for output format
4. Pass the suppression list from step 3
5. Spawn as an agent (parallel when possible)

Each cabinet member agent follows a two-phase protocol:
- **Phase A — Explore:** Read broadly, examine the codebase through this
  cabinet member's lens. Take notes on everything observed.
- **Phase B — Rank and emit:** From everything observed, select the top
  5-8 findings that matter most. Apply the output contract. Emit JSON.

The two-phase protocol prevents premature commitment — the cabinet member
sees everything before deciding what to report. Without it, the first
interesting thing found dominates the output.

### 5. Merge and Persist Findings (core)

Read `phases/finding-output.md` for how to persist and report the
audit results.

**Default (absent/empty):**
1. Create a timestamped run directory: `reviews/YYYY-MM-DD/HH-MM-SS/`
2. Write each cabinet member's JSON output to the run directory
3. Run `scripts/merge-findings.js <run-dir>` to produce `run-summary.json`
4. Run `scripts/merge-findings.js <run-dir> --db` to also ingest into
   the reference data layer (if pib-db is initialized)
5. Present findings summary: total count, breakdown by severity, by
   cabinet member, and highlight any critical findings

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
| `member-selection.md` | Default: discover all, present committees if available | Which cabinet members to run |
| `structural-checks.md` | Skip | Fast structural checks before full audit |
| `triage-history.md` | Default: run load-triage-history.js | How to load suppression lists |
| `member-execution.md` | Default: parallel agents with two-phase protocol | How to run cabinet member agents |
| `finding-output.md` | Default: timestamped dir + merge + pib-db ingest | How to persist and report findings |

## How Audit Connects to Other Skills

**Orient** verifies operational state — is the system running, is data
fresh, are processes alive? **Audit** verifies quality and alignment —
does the system do what it claims, is it drifting, are conventions
holding? Orient runs every session; audit runs periodically or on
demand.

**Debrief** captures session-specific lessons — what was learned during
this work session. **Audit** captures systematic observations from
cabinet members — what would a specialist notice? Debrief lessons
come from doing; audit findings come from looking.

**Triage-audit** is the audit's partner. Audit generates findings;
triage presents them for human judgment. Without triage, findings
accumulate and are never acted on. Without audit, triage has nothing
to triage. They form a closed loop.

**Pulse** watches self-description accuracy — do counts match, do
documented states match reality? Audit watches quality through domain
cabinet member lenses. Pulse is fast and embedded; audit is thorough and
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
- Cabinet member evaluation (track which cabinet members consistently produce
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

Every two weeks, the audit runs. Cabinet member agents examine the codebase
through different lenses — architecture, code quality, UX, security,
process adherence. Findings go through triage: the user fixes what
matters, defers what can wait, rejects what's noise. Each cabinet member
learns from rejections (calibration drift). Conventions stay enforced
because someone is checking. Drift is caught at one commit, not ten.

The system maintains quality not through heroic effort but through
regular, structured observation.
