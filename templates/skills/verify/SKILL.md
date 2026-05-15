---
name: verify
description: |
  Walkthrough verification harness. Cucumber + Playwright scenarios with
  human-in-the-loop verdict pauses (P/I/S/N) for subjective checks.
  Subcommands: bare (run the suite), 'learn' (bootstrap from cold start),
  'update <change>' (sync feature files to a code change), 'backfill <fid>'
  (add a Verify Plan section to a pending action's notes). Use when:
  "verify", "/verify", "/verify learn", "/verify update", "/verify backfill",
  "run walkthrough", "verify scenarios", after a multi-PR umbrella ships.
related:
  - type: file
    path: .claude/skills/verify/phases/discover.md
    role: "What to scan during /verify learn (routes, components, memory)"
  - type: file
    path: .claude/skills/verify/phases/draft.md
    role: "How to group discovered surfaces into scenarios"
  - type: file
    path: .claude/skills/verify/phases/calibrate.md
    role: "Interview questions before generating .feature files"
  - type: file
    path: .claude/skills/verify/phases/update.md
    role: "How change descriptions map to feature-file edits"
  - type: file
    path: .claude/skills/verify/phases/generate.md
    role: "Write .feature files + step stubs after calibrate confirms"
  - type: file
    path: .claude/skills/verify/phases/scenario-template.md
    role: "Gherkin scenario template (cost+role tags, NN.NN checkIds)"
  - type: file
    path: .claude/skills/verify/phases/backfill.md
    role: "How to draft a ## Verify Plan section for a pending action"
  - type: file
    path: cabinet/_briefing.md
    role: "Project identity and configuration"
argument-hint: "subcommand — 'learn', 'update <change>', 'backfill <fid>', or empty to run"
user-invocable: true
standing-mandate: []
---

# /verify — Walkthrough Verification Harness

## Arguments

If `$ARGUMENTS` is provided:
- **Empty**: Run the verification suite (`npm run verify` in the project's
  `e2e/` directory). Default behavior.
- **'learn'**: Bootstrap or extend the harness. Discover routes/components,
  draft scenarios, calibrate with the user, generate `.feature` files +
  step stubs. Re-runnable; same flow whether starting from zero or
  extending an existing scenario set.
- **'update <change-description>'**: Sync feature files to a code change.
  The change can be a pib-db action fid, a diff snippet, or free-text.
- **'backfill <fid>'**: Add a `## Verify Plan` section to a pending action's
  notes. For actions that were planned before the verify module existed,
  or planned without Verify Plan questions surfaced. Reads the existing
  notes, interviews the user one question at a time about UI surface and
  feature-file edits, drafts the section, and appends via
  `pib_update_action`. Does NOT modify feature files — that's `/execute`'s
  job at action ship time.

## Purpose

Manual verification of multi-PR umbrellas is the sticking point for solo
operators. Flat lists of 100+ atomic acceptance criteria get verified
once and never again; surface-area maps fragment user flows across
components. The walkthrough pattern — scenarios grouped by user journey,
each with mostly-automated checks and a human-in-the-loop pause for
subjective verdicts — survives the "I have to do this every release"
test that flat AC lists fail.

`/verify` provides the runtime (Cucumber + Playwright + the
`cabinet-verify` npm package) plus the orchestration skill (this file)
to:

1. **Bootstrap** a harness from cold start in <30 minutes via `/verify learn`
2. **Run** the suite during a session via bare `/verify`
3. **Keep scenarios in sync** with the product via `/verify update`

The harness shines for projects that already ship multi-PR umbrellas
where post-merge verification is a recurring chore. It's overkill for
single-PR features.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration (what to do and in what order) is generic; phase files
customize the specifics for your project.

### Phase File Protocol

Phase files have three states:

| State | Meaning |
|-------|---------|
| Absent or empty | Use this skeleton's **default behavior** for the phase |
| Contains only `skip: true` | **Explicitly opted out** — skip this phase entirely |
| Contains content | **Custom behavior** — use the file's content instead |

The skeleton always does something reasonable when a phase file is
absent. Phase files customize, not enable.

## Why This Matters

Without a walkthrough harness, every multi-PR umbrella ships with a
flat AC list. The first verification round runs through it once. The
second never happens. The third release, scenarios drift from the
product and nobody notices the regression until a user reports it.

`/verify learn` solves the bootstrap problem (the 30-min interview
produces a usable scenario set). The `cabinet-verify` runtime solves
the human-in-the-loop pause (a verdict char is faster than typing a
sentence and clicking Save in a review UI). `/verify update` solves
the drift problem (when a code change lands, the feature file
gets the matching edit in the same session).

The integration phases for `/plan`, `/execute`, and `/debrief`
(installed as customization phases when the `verify` module is selected
during `npx create-claude-cabinet`) close the loop further: plans
include feature-file edits as ACs, `/execute` writes them alongside
code, `/debrief` warns when a UI act shipped without a covering
scenario change.

## Workflow

### Mode A: bare `/verify` — run the suite

1. Check if `e2e/` exists in the project root. If not, recommend
   `/verify learn` and exit.
2. Run `npm run verify` from the project's `e2e/` dir.
3. Surface the output. If failures or I-verdicts landed, suggest
   `npm run report:last` to triage.

This mode is intentionally thin — the harness is the value, not
the wrapping. If the user wants `verify:cheap` or `verify:full`,
they invoke npm scripts directly.

### Mode B: `/verify learn` — bootstrap

The "learn" flow runs four phases:

1. **Discover** (read `phases/discover.md`): scan the project for UI
   surfaces. Routes, components, persona signals, memory entries.
   Default behavior dispatches parallel subagents per category —
   each returns a structured summary so the main session's context
   stays small. Cap output at 20 items per category.

2. **Draft** (read `phases/draft.md`): group discovered surfaces into
   scenarios. Default: invoke cabinet-qa via subagent for the
   "what's worth a scenario" judgment — pass the discovered routes/
   components, cabinet-qa returns a list of scenario-worthy flows.
   Cap initial draft at **≤5 scenarios** to force calibration before
   expansion. (Per process-therapist's feedback during the extraction
   plan: avoid the seed-style over-proposal trap.)

3. **Calibrate** (read `phases/calibrate.md`): interview the user one
   question at a time. Examples: "I see admin routes but only one admin
   user — real persona or fold into main?", "Should the fresh-user
   flow be its own scenario or part of admin?", "What's the dev stack
   URL for preflight?". Do NOT batch questions — one at a time per
   project convention.

4. **Generate** (read `phases/generate.md`): write the `.feature`
   files using the template in `phases/scenario-template.md` plus
   step-definition stubs. If `e2e/` doesn't yet exist, run
   `install.sh` first to scaffold the directory structure.

After generation, the user runs `npm install && npm run verify` from
`e2e/` to drive the first scenarios.

### Mode C: `/verify update <change>` — sync scenarios

Read `phases/update.md` for how change descriptions map to feature-file
edits. Three input shapes the default handles:

- **Action fid** (`act:abc12345`): read the pib-db action notes, find
  the affected component or route in the description, search
  `e2e/features/*.feature` for matching step text, propose edits.
- **Diff snippet** (paste): identify modified routes/components from
  the diff, search features for steps that exercise them, propose
  edits.
- **Free text**: parse intent, search features by keyword, propose
  edits.

If no scenario fits the change, escalate to `learn` mode (the user
may want a new scenario, not an edit to an existing one).

The proposed edits are presented inline. User approves, the skill
writes them.

### Mode D: `/verify backfill <fid>` — add Verify Plan to pending action

Read `phases/backfill.md` for the full flow. Brief overview:

1. **Load the action.** Call `pib_get_action <fid>`. Read the
   action's `text` and `notes` (especially the `## Surface Area`
   section). Confirm the action is pending (`completed = 0`) — if
   already shipped, redirect the user to `/verify update <fid>`.
2. **Read existing feature files.** `ls e2e/features/*.feature` so
   the interview can reference real scenarios and checkIds.
3. **Interview, one question at a time.** Per CLAUDE.md global
   convention. Walk the user through: which features need edits,
   what verb (ADD/MODIFY/REMOVE/NEW), what anchor or scenario name.
4. **Draft the section.** Format matches `verify-plan.md`'s output
   spec (one `- features/<file>.feature:` line per entry).
5. **Show the diff.** Display the action's current notes alongside
   the proposed appended section.
6. **Confirm + write.** On approval, call `pib_update_action` with
   the augmented notes. Without approval, exit without changes.

This mode does NOT modify feature files. That's `/execute`'s job
once the action runs. Backfill only adds the planning artifact so
`/execute`'s `verify-emit` phase has something to read.

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `discover.md` | Default: parallel subagent fan-out (routes, components, memory, optional UI crawl) | Project-specific signals to scan |
| `draft.md` | Default: cabinet-qa subagent + ≤5 scenario cap | How surfaces map to scenarios |
| `calibrate.md` | Default: example questions (persona, dev URL, role count) | Project-specific interview questions |
| `generate.md` | Default: write .feature + step stubs from calibrated draft | Generation rules (collision handling, naming) |
| `update.md` | Default: action fid / diff / free-text dispatch | How change descriptions map to edits |
| `scenario-template.md` | Default: Gherkin with cost+role tags, NN.NN checkIds | Project-specific scenario shape |
| `backfill.md` | Default: interview-driven Verify Plan section drafting | Project-specific backfill questions |

## Principles

- **One question at a time.** Calibrate phase NEVER batches questions
  (per CLAUDE.md global convention). Each answer shapes the next.
- **≤5 scenarios on initial draft.** Force calibration before
  expansion. Adding scenarios later is cheap; removing scenarios
  the user didn't ask for is expensive (per process-therapist).
- **cabinet-qa owns "what's worth a scenario".** /verify learn
  delegates that judgment via subagent; it doesn't re-derive it.
- **The .feature file is the spec.** Anyone (user, future Claude,
  future-future user) reads `features/01-desktop-rewrite.feature` to
  understand what's being verified. Step definitions are
  implementation; features are the contract.
- **CheckId convention is project-driven.** This skill ships defaults
  (`NN.NN` token in quoted-arg or bare form, per CONVENTIONS.md)
  but the consuming project's `scenario-template.md` may override.

## Calibration

**Core failure this targets:** post-merge verification of multi-PR
umbrellas never happens because the cost of starting is too high.
Flat AC lists work once. Walkthrough harnesses survive.

### Without Skill (Bad)

User ships a 4-PR mobile-display umbrella. Files 122 acceptance
criteria in pib-db, opens the review UI, gets through 30 of them,
gets pulled into something else. The remaining 92 sit untriaged.
Three months later, a regression in the mobile flow lands and
nobody catches it for two weeks because nobody re-verified.

### With Skill (Good)

Same umbrella. After merge, the user runs `/verify learn` once
(30-min one-time cost). 4 scenarios get generated grouped by user
journey. Each subsequent re-verify is `npm run verify` (~5 min for
the automated portion) + ~10 min of human-verdict pauses. When the
user ships a related change in the future, `/verify update <fid>`
keeps the scenarios in sync. The 122-item flat list is replaced
by 4 re-runnable journeys.
