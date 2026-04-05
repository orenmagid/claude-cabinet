---
model: opus
name: execute
description: |
  Execute a single plan with perspective-based guardrails at structured
  checkpoints. Reads the plan, activates relevant perspectives, implements
  file-group by file-group with checkpoint reviews. This is a skeleton skill
  using the phases/ directory pattern. Use when: "execute this plan",
  "implement this", "/execute".
related:
  - type: skill
    name: validate
  - type: file
    path: .claude/skills/execute/phases/load-plan.md
    role: "Project-specific: where plans live and how to read them"
  - type: file
    path: .claude/skills/execute/phases/perspectives.md
    role: "Project-specific: which perspectives to activate for execution"
  - type: file
    path: .claude/skills/execute/phases/verification-tools.md
    role: "Project-specific: tools for checking acceptance criteria"
  - type: file
    path: .claude/skills/execute/phases/validators.md
    role: "Project-specific: what validation to run"
  - type: file
    path: .claude/skills/execute/phases/commit-and-deploy.md
    role: "Project-specific: how to persist and deploy changes"
  - type: file
    path: .claude/skills/perspectives/_context.md
    role: "Project identity and configuration"
---

# /execute — Plan Execution with Perspective Checkpoints

## Purpose

Execute a single implementation plan with structured checkpoints where
expert perspectives provide feedback. This is the inner loop — it takes
one plan and implements it with guardrails. The perspective checkpoints
catch issues that code review alone would miss: security gaps, data
integrity violations, boundary condition failures.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration (checkpoints, escalation, verification protocol) is generic.
Your project defines the specifics in phase files under `phases/`.

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

Without structured execution, the common failure mode is: implement,
compile, commit, mark done. The feature looks complete but acceptance
criteria were never verified, the pre-commit sweep never happened,
and the edge case that a boundary-conditions perspective would have
flagged ships to production.

The checkpoint protocol catches issues at three scales:
1. **Pre-implementation** — is the plan safe to start?
2. **Per-file-group** — do these changes look right in isolation?
3. **Pre-commit** — do all changes work together?

Each checkpoint is a chance to stop before the cost of fixing goes up.

## Workflow

### 1. Load the Plan

Read `phases/load-plan.md` for where your project stores plans and how
to read them (action notes, markdown files, issue tracker, etc.).

**Default (absent/empty):** Expect the plan to be provided in
conversation or referenced by the user. Ask which plan to execute if
it's not clear.

Identify from the plan:
- **Implementation steps** — what to do
- **Surface area** — which files
- **Acceptance criteria** — how to confirm it works
- **Plan type** — code plan (has file changes) or walkthrough plan
  (manual setup, configuration, purchase)

#### Walkthrough Plans (non-code)

If the plan has no code changes, skip the file-group implementation
loop (Steps 4-5) and instead:
1. Present each step conversationally
2. Walk the user through each step, confirming completion
3. Help troubleshoot if something doesn't work as expected
4. Verify acceptance criteria as each step completes

### 2. Activate Perspectives

Read `phases/perspectives.md` for which perspectives to activate during
execution, any always-on perspectives, and any project-specific rules.

**Default (absent/empty):** Read `.claude/skills/perspectives/*/SKILL.md`
and select perspectives whose activation signals match:
- **always-on-for: execute** — always included
- **File patterns** — any file in the plan's surface area matches
- **Topic keywords** — any keyword in the plan description matches

Err toward inclusion. A perspective that activates unnecessarily costs
a few seconds; one that doesn't activate when needed costs rework.

Prepare reusable context for agent prompts: read `_context.md` once and
keep the essential facts ready to paste into each agent's prompt.

If no perspectives exist in the project, skip all checkpoint steps
(3, 4b, 5) and execute the plan directly. Checkpoints add depth, not
structure.

### 3. Checkpoint 1: Pre-Implementation Review (Parallel Agents)

Before writing any code, **spawn one Agent per activated perspective**
in a single message. Each receives:
- The perspective's full SKILL.md content
- Essential project context from `_context.md`
- The plan text and list of files that will change
- Instructions to evaluate whether the plan is safe to start

Each agent returns:
```json
{
  "perspective": "name",
  "verdict": "continue" | "pause" | "stop",
  "concerns": [
    { "description": "...", "evidence": "...", "severity": "blocking" | "advisory" }
  ]
}
```

**Collect all verdicts.** Apply escalation:
- Any **stop** → halt, show concern, require explicit override from user
- Any **pause** → show concern with options: proceed / address / abort
- 3+ **pause** → escalate to stop-equivalent
- All **continue** → proceed with brief summary

### 4. Implement (File Group by File Group)

Group the plan's implementation steps by logical file groups
(e.g., "backend API changes", "frontend components", "types and schemas").

For each group:
1. Make the changes
2. **Checkpoint 2: File Group Review** — if perspectives are active,
   spawn agents for ONLY perspectives matching the changed files. Each
   receives the git diff for this file group + plan context. Same
   escalation rules as Checkpoint 1.
3. If all continue, move to the next group

File-group granularity keeps reviews focused. A perspective reviewing
3 changed files gives better feedback than one reviewing 30.

### 5. Checkpoint 3: Pre-Commit Sweep (Parallel Agents)

After all implementation is complete, **spawn one Agent per activated
perspective** in a single message. Each receives the full git diff of
all changes + plan context.

Earlier "continue" concerns are re-checked — a concern that was minor
in isolation may be significant in the aggregate.

### 6. Validate and Commit

After Checkpoint 3 passes:

**a. Run validators.** Read `phases/validators.md` for what validation
to run.

**Default (absent/empty):** Run whatever the project's `/validate` skill
does. If no validate skill exists, at minimum check that the code
compiles and lints cleanly.

If validation fails, fix issues and re-run Checkpoint 3 for the fix.

**b. Commit and deploy.** Read `phases/commit-and-deploy.md` for how
your project persists and deploys changes.

**Default (absent/empty):** Commit with a clear message describing the
implementation. Don't push or deploy unless the phase file says to —
deployment strategy is project-specific.

### 7. Verify Acceptance Criteria (QA Gate — MANDATORY)

Walk through **every** acceptance criterion in the plan, one by one.

Read `phases/verification-tools.md` for what tools your project has
for verifying criteria.

**Default (absent/empty):** Use whatever tools are available in the
environment. For [auto] criteria, run the command. For [manual] criteria,
attempt verification with available tools before deferring to the user.

For each criterion, determine its category and verify accordingly:

- **[auto] criteria** — RUN the check. Execute the command, curl the
  endpoint, run the test. Record the actual output.

- **[manual] criteria** — Use whatever verification tools are available
  (preview tools, browser automation, test runners). **Use tools before
  deferring to the user.** Only defer when tools genuinely cannot verify
  the criterion.

- **[deferred] criteria** — Note them as not yet verifiable. This
  category is for criteria that depend on infrastructure not yet
  available. It is NOT a bucket for checks you could do with tools.

**Report format:**
```
## AC Verification
Criteria: N total (X auto, Y verified-via-tools, Z needs-user, W deferred)
- [pass] [criterion] — verified: [actual result]
- [pass] [criterion] — verified via tools: [evidence]
- [user] [criterion] — needs-user: [why tools can't verify]
- [wait] [criterion] — deferred: [why not testable now]
- [FAIL] [criterion] — expected [X], got [Y]
```

**If any [auto] criterion fails: STOP.** Fix the issue before proceeding.
Do not mark the work item complete with failing AC.

### 8. Close the Loop

Mark the work item as complete (if your project has a work tracker).
Run debrief if this was a full session. At minimum, ensure the work
is committed, validated, and verified before considering it done.

### 9. Discover Custom Phases

Check for any additional phase files in `phases/` that the skeleton
doesn't define. Execute them at their declared position.

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `load-plan.md` | Default: plan from conversation | Where plans live, how to read them |
| `perspectives.md` | Default: match by activation signals | Which perspectives, special rules |
| `verification-tools.md` | Default: use available env tools | Project-specific verification tools |
| `validators.md` | Default: run validate skill or linter | What validation to run |
| `commit-and-deploy.md` | Default: commit, don't push/deploy | How to persist and deploy changes |

## Principles

- **Perspectives are guardrails, not gates.** The user always has the
  final say. Stop verdicts require explicit override, not automatic
  rejection.
- **Err toward inclusion** when selecting perspectives. Better to have
  a perspective say "looks fine" than to miss a concern.
- **File-group granularity** keeps checkpoint reviews focused. A
  perspective reviewing 3 changed files gives better feedback than one
  reviewing 30.
- **The pre-commit sweep catches emergent issues.** Individual file
  groups may look fine but create problems in combination (type
  mismatches across boundaries, security gaps from API + frontend
  changes together).

## Calibration

**Core failure this targets:** Marking work complete without verifying
every acceptance criterion. The most dangerous variant isn't skipping
AC entirely — it's running some, fixing what fails, and not re-verifying
that the fix didn't break something else.

### Without Skill (Bad)

Plan says to add a new API endpoint + UI page. Claude implements the
endpoint and page, runs the type checker, sees it compiles. Commits.
Marks the work item complete. The plan had "[auto] POST /api/foo
returns 201" — never tested. The endpoint has a typo in the route
handler that returns 404. The "[manual] New page shows data table
with sorting" criterion was never checked — the page renders but the
sort handler throws. Two failing criteria, marked complete.

### With Skill (Good)

Same plan. Claude implements file-group by file-group with checkpoint
reviews. After implementation, walks through every AC line by line.
The auto criterion fails — route typo found and fixed. Re-verifies.
Manual criteria checked with available tools. Only marks complete
when all criteria pass. The next session inherits verified work, not
an assumption.
