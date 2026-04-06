---
name: pulse
description: |
  Self-description accuracy check. Verifies that what the system claims
  matches what the system actually is — counts, states, conventions,
  documented behaviors. Two modes: embedded (silent in orient/debrief,
  15-second budget) and standalone (systematic, three categories).
  Use when: embedded in orient/debrief, "pulse", "/pulse", or when
  system descriptions feel stale.
related:
  - type: file
    path: .claude/skills/pulse/phases/checks.md
    role: "Project-specific: what to verify"
  - type: file
    path: .claude/skills/pulse/phases/auto-fix-scope.md
    role: "Project-specific: what can be fixed automatically"
  - type: file
    path: .claude/skills/pulse/phases/output.md
    role: "Project-specific: how to present results"
  - type: file
    path: cabinet/_briefing.md
    role: "Project identity and configuration"
---

# /pulse — Self-Description Accuracy Check

## Purpose

Self-description drifts from reality. A status file says "12 skills"
but the directory has 14. A CLAUDE.md documents a workflow that was
replaced two weeks ago. A configuration file references a path that
was renamed. These discrepancies are small individually but compound
into a system that describes one thing and does another — creating
confusion, wasted effort, and incorrect assumptions.

Pulse catches these before they compound. It's the system's mirror:
hold up what you claim to be, check what you actually are, and flag
every gap.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration is generic. Your project defines the specifics — what
to check, what to auto-fix, how to report — in phase files under
`phases/`.

### Phase File Protocol

Phase files have three states:

| State | Meaning |
|-------|---------|
| Absent or empty | Use this skeleton's **default behavior** for the phase |
| Contains only `skip: true` | **Explicitly opted out** — skip this phase entirely |
| Contains content | **Custom behavior** — use the file's content instead |

## Identity

You are the mirror. You don't judge quality or propose improvements —
that's the auditor's job. You verify accuracy: does the description
match the thing it describes? You are fast, factual, and silent when
everything checks out.

Your checks are mechanical: count files and compare to documented
counts, read paths and verify they exist, check dates and flag staleness.
You don't interpret or weigh significance — you just report
discrepancies. The human decides which ones matter.

## Two Modes

### Embedded Mode (in orient/debrief)

Silent when healthy. Runs within a 15-second budget as part of orient
or debrief. Only speaks if something needs attention. This is how pulse
runs most of the time — a background health check that's invisible when
the system is accurate.

**When embedded in orient:** Check before the briefing so any issues
can be included in the briefing.

**When embedded in debrief:** Check after state updates so the debrief
can fix any discrepancies before the session closes.

### Standalone Mode (/pulse)

Systematic check across three categories. Used when you suspect drift
has accumulated or want a comprehensive accuracy check. Reports
everything — not just problems.

## Workflow

### 1. Run Checks (core)

Read `phases/checks.md` for what to verify.

**Default (absent/empty):** Run three categories of checks:

**Category A — Count Freshness.** Enumerate actual items and compare
to any documented counts. Examples:
- Count files matching `skills/*/SKILL.md` vs any documented skill count
- Count files matching `skills/cabinet-*/SKILL.md` vs documented
  cabinet member count
- Count entries in configuration files vs documented totals
- Count items in any enumerated list vs documented count

**Category B — Dead Reference Spot-Check.** Pick 3-5 paths, references,
or links from documentation files (CLAUDE.md, README.md, status files)
and verify they resolve:
- File paths — does the file exist?
- Directory references — does the directory exist?
- Script references — does the script exist and is it executable?
- Cross-references between docs — does the target section exist?

**Category C — Staleness Detection.** Check for time-sensitive content
that may have drifted:
- Files with dates in their content — is the date current?
- "Last updated" or "as of" references — how old are they?
- Version numbers or counts that should change as the project evolves

In embedded mode, run a quick subset (one check from each category).
In standalone mode, run all checks.

### 2. Determine Auto-Fix Scope (core)

Read `phases/auto-fix-scope.md` for what can be fixed automatically
without human judgment.

**Default (absent/empty):** Auto-fix is limited to numeric counts only.
If a document says "12 skills" and you counted 14, update the number.
Everything else — stale descriptions, dead references, outdated
workflows — gets reported but not changed, because the fix might
require judgment about what the correct content should be.

**The closed-list principle:** Only auto-fix what's mechanically
verifiable. A count is either right or wrong. A description is a matter
of judgment. Pulse auto-fixes the first kind and reports the second.

### 3. Present Output (presentation)

Read `phases/output.md` for how to present results.

**Default (absent/empty):**

In **embedded mode**: silence means health. Only speak if there are
discrepancies. When reporting, be brief: "Pulse: skill count says 12,
found 14. Dead ref: `scripts/old-tool.sh` (referenced in README)."

In **standalone mode**: present a stratified report:
- **Fixed** — discrepancies auto-corrected (with what changed)
- **Options** — discrepancies that need human judgment (with what you
  found vs what's documented)
- **Questions** — things you couldn't verify or aren't sure about

### 4. Discover Custom Phases

After running the core phases above, check for any additional phase
files in `phases/` that the skeleton doesn't define. Execute them at
their declared position.

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `checks.md` | Default: count freshness + dead refs + staleness | What to verify |
| `auto-fix-scope.md` | Default: numeric counts only | What can be fixed automatically |
| `output.md` | Default: silent-when-healthy (embedded) or stratified (standalone) | How to present results |

## How Pulse Connects to Other Skills

**Orient** checks operational state — is the system running? **Pulse**
checks descriptive accuracy — does the documentation match reality?
Orient runs first; pulse runs inside orient (embedded) to catch stale
descriptions before they mislead.

**Audit** examines quality through expert cabinet members — is the code
good, is the architecture sound? **Pulse** examines accuracy through
mechanical comparison — does the number match? Audit requires judgment;
pulse requires counting. They complement each other: pulse catches the
trivially verifiable so audit can focus on the substantive.

**Debrief** updates state files after work. **Pulse** verifies those
updates are consistent. When pulse runs inside debrief, it catches
cases where the debrief updated one file but not another.

### Boundary Table

| Question | Tool |
|----------|------|
| "Is this code correct?" | /audit |
| "Is the documentation accurate?" | /pulse |
| "Does the count match?" | /pulse |
| "Is the architecture sound?" | /audit |
| "Is the system running?" | /orient |

Projects with additional skills extend this table in their SKILL.md.

## Extending

To customize a phase: write content in the corresponding `phases/` file.
To skip a phase: write only `skip: true` in the file.
To add a phase: create a new file in `phases/`.

Examples of checks mature projects add:
- Schema validation (do entity definitions match what's in the database?)
- Hook verification (do configured hooks still point to valid scripts?)
- Dependency freshness (are documented dependencies still current?)
- Environment consistency (do env vars match what scripts expect?)

## Calibration

**Core failure this targets:** Self-description gradually diverging from
reality until the documentation becomes misleading rather than helpful.

### Without Skill (Bad)

The project evolves over months. Each session builds features, refactors
code, reorganizes directories. Documentation gets updated sometimes but
not always. The README says the project has 12 skills, but 3 more were
added. A CLAUDE.md references a script that was renamed. The status file
describes a workflow that was replaced last month.

Someone reads the documentation and builds a mental model based on what
it says. That mental model is wrong. They make decisions based on it.
The documentation has become an actively misleading artifact.

### With Skill (Good)

Every session, pulse runs embedded. Counts are verified, references are
spot-checked, staleness is detected. Most of the time it's silent —
everything checks out. When a count drifts, it's auto-fixed. When a
reference dies, it's flagged and fixed in the same session.

The documentation stays accurate not through discipline but through
verification. The system describes what it is because something is
always checking.

## Assessment Log

Standalone pulse appends lightweight eval results here. Each entry
records the date, mode, counts of findings by category, and any skills
assessed. This section accumulates over time — it's pulse's memory of
what it has checked and found.

(No assessments yet. First standalone /pulse run will establish the baseline.)
