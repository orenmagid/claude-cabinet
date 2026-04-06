---
name: triage-audit
description: |
  Audit finding triage. Loads findings, prepares commentary, presents for
  human judgment via local web UI or CLI, then applies verdicts — updating
  triage status, attempting auto-fixes, and creating actions for approved
  findings. The loop-closer: without triage, audit findings accumulate and
  are never acted on. Use when: "triage", "/triage-audit", after an audit
  run, or when untriaged findings exist.
related:
  - type: file
    path: .claude/skills/triage-audit/phases/load-findings.md
    role: "Project-specific: where to load findings from"
  - type: file
    path: .claude/skills/triage-audit/phases/triage-ui.md
    role: "Project-specific: how to present findings for triage"
  - type: file
    path: .claude/skills/triage-audit/phases/apply-verdicts.md
    role: "Project-specific: how to act on triage decisions"
  - type: file
    path: scripts/triage-server.mjs
    role: "Local HTTP server for triage UI"
  - type: file
    path: scripts/triage-ui.html
    role: "Browser-based triage interface"
  - type: file
    path: scripts/pib-db.js
    role: "Reference data layer for finding persistence"
  - type: file
    path: cabinet/_briefing.md
    role: "Project identity and configuration"
---

# /triage-audit — Audit Finding Triage

## Purpose

Close the audit loop. The audit generates findings; triage presents them
for human judgment. Without triage, findings accumulate in JSON files
and are never acted on — or worse, the same findings regenerate every
audit run because they were never explicitly dismissed.

Triage is where human judgment enters the system. Claude can observe
patterns and flag concerns, but only the user knows which concerns
matter for this project at this time. A finding that looks critical in
isolation might be irrelevant given the project's priorities. A finding
that looks minor might be the canary for a deeper issue the user
recognizes. Triage captures that judgment.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration is generic. Your project defines the specifics — where to
load findings, how to present them, how to apply verdicts — in phase
files under `phases/`.

### Phase File Protocol

Phase files have three states:

| State | Meaning |
|-------|---------|
| Absent or empty | Use this skeleton's **default behavior** for the phase |
| Contains only `skip: true` | **Explicitly opted out** — skip this phase entirely |
| Contains content | **Custom behavior** — use the file's content instead |

## Identity

You are the facilitator. You don't make triage decisions — you prepare
the context so the user can make good ones quickly. For each finding,
you add commentary: what you think about it, what the fix might involve,
how it relates to other findings or to work already in progress. Your
commentary is a suggestion. The user's verdict is the decision.

Your job is to minimize triage friction. Every finding should be
presented with enough context that the user can decide in seconds, not
minutes. Group related findings. Highlight the ones that matter most.
Make the verdict buttons (Fix / Defer / Reject) the easiest thing to
click.

## Verdicts

Three verdicts, plus a question escape hatch:

| Verdict | Meaning | Effect |
|---------|---------|--------|
| **Fix** | This finding is real and should be addressed | Creates an action or triggers auto-fix |
| **Defer** | Real but not now — revisit later | Suppressed in future audits until explicitly resurfaced |
| **Reject** | Not a real problem for this project | Permanently suppressed in future audits |
| **?** (Question) | Need more information before deciding | Finding stays open, question is recorded |

**Fix** doesn't mean "fix right now." It means "this is approved for
action." The action goes into the work tracker; when it gets done is a
scheduling decision.

**Defer** needs a reason. "Not now" is acceptable if the user has a
clear sense of when. "Maybe someday" is a reject in disguise — push
back gently.

**Reject** means "this is noise for our project." A high rejection rate
for a cabinet member is signal that the cabinet member's calibration is off.

## Workflow

### 1. Load Findings (core)

Read `phases/load-findings.md` for where to get the findings to triage.

**Default (absent/empty):** Query the reference data layer (pib-db) for
findings with `triage_status = 'open'`. If pib-db is not initialized or
has no findings, fall back to reading the most recent
`reviews/*/run-summary.json` file.

Present a summary before triage: how many findings, breakdown by
severity and cabinet member, how many are new vs previously seen.

### 2. Present for Triage (core)

Read `phases/triage-ui.md` for how to present findings for human judgment.

**Default (absent/empty):**
1. Prepare commentary for each finding — your assessment of importance,
   suggested approach, relationship to other findings or open work
2. Start the local triage server: `node scripts/triage-server.mjs`
3. POST findings with commentary to the server's API
4. Tell the user to open the triage UI in their browser
5. Wait for the user to complete triage (verdicts come back via the
   server's API)

**IMPORTANT:** Never summarize away findings. Every finding must be
visible in the triage UI with its full context — title, description,
assumption, evidence, question, and your commentary. The user needs to
see everything to make good decisions.

**Fallback (no browser available):** Present findings in the conversation
grouped by cabinet member, severity-ordered within each group. Ask for
verdicts one group at a time to avoid overwhelming.

### 3. Apply Verdicts (core)

Read `phases/apply-verdicts.md` for how to act on the user's triage
decisions.

**Default (absent/empty):** For each verdict:

**Fix verdicts:**
1. Update finding's triage_status to 'approved' in pib-db
2. If the finding is marked `autoFixable: true`, attempt the fix
   immediately. Verify the fix works before marking it done.
3. If not auto-fixable, create an action in pib-db with:
   - Text: the finding title
   - Notes: finding description, evidence, suggested fix
   - Area: derived from cabinet member or finding metadata

**Defer verdicts:**
1. Update finding's triage_status to 'deferred' in pib-db
2. Record the user's reason in triage_notes
3. The finding will be suppressed in future audit runs

**Reject verdicts:**
1. Update finding's triage_status to 'rejected' in pib-db
2. Record the user's reason in triage_notes
3. The finding will be permanently suppressed in future audit runs

**Question verdicts:**
1. Finding stays open (triage_status remains 'open')
2. Record the question in triage_notes
3. The finding will appear again in the next triage

If pib-db is not initialized, write verdicts to
`reviews/<run-dir>/triage.json` as a fallback. The next audit's
`load-triage-history.js` will find them there.

After applying all verdicts, present a summary: how many fixed
(auto-fixed vs action created), deferred, rejected, questioned.

### 4. Discover Custom Phases

After running the core phases above, check for any additional phase
files in `phases/` that the skeleton doesn't define. Execute them at
their declared position.

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `load-findings.md` | Default: query pib-db, fall back to run-summary.json | Where findings come from |
| `triage-ui.md` | Default: local triage server + browser UI | How findings are presented |
| `apply-verdicts.md` | Default: update pib-db + auto-fix + create actions | How verdicts are applied |

## How Triage Connects to Other Skills

**Audit** generates findings; **triage** presents them for judgment and
applies the decisions. They form a closed loop: audit → triage → suppression
→ next audit skips triaged items.

**Fix verdicts create actions** that appear in orient's work scan and
debrief's close-work phase. The triage finding becomes a tracked work
item through the standard work lifecycle.

**Reject/defer verdicts feed back** into future audits via the triage
suppression list. Cabinet members learn what this project cares about by
seeing what gets rejected — persistent rejections from a cabinet member
signal calibration drift (see `cabinet/_lifecycle.md`).

**The enforcement pipeline** watches for recurring approved findings.
If the same type of finding keeps getting approved across multiple
audits, it's a candidate for promotion to a rule or hook — structural
prevention instead of repeated detection.

## Extending

To customize a phase: write content in the corresponding `phases/` file.
To skip a phase: write only `skip: true` in the file.
To add a phase: create a new file in `phases/`.

Examples of phases mature projects add:
- Batch auto-fix (attempt all auto-fixable findings before presenting
  the rest for manual triage)
- Trend surfacing (show how this run compares to previous runs)
- Deferred resurfacing (periodically bring back deferred findings for
  re-evaluation based on time or project changes)
- Team notification (alert team members about findings in their area)

## Calibration

**Core failure this targets:** Audit findings that are generated but
never acted on, creating a growing backlog of untriaged items that makes
the entire audit system feel useless.

### Without Skill (Bad)

An audit runs and produces 30 findings. They sit in a JSON file. The
next audit runs and produces 35 findings — including 25 of the same
ones. The user glances at the list, feels overwhelmed, and ignores it.
After three audit runs with no triage, the audit itself gets skipped
because "it just generates noise."

The system has a learning mechanism (audit) but no judgment mechanism
(triage). Without judgment, the learning is wasted.

### With Skill (Good)

An audit runs and produces 30 findings. Triage presents them in a
browser UI, grouped by cabinet member, with commentary on each. The user
works through them in 15 minutes: fixes 5 (2 auto-fixed, 3 become
actions), defers 8, rejects 17. The next audit produces 12 new
findings — the 17 rejected and 8 deferred are suppressed. The triage
queue stays manageable.

Over time, the system learns what matters to this project. Cabinet members
that consistently produce rejected findings get retired or recalibrated.
The audit becomes more precise with each cycle.
