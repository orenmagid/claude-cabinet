---
name: validate
description: |
  Run structural validation checks and present a unified summary. The
  orchestration pattern is generic; the specific validators are project-defined
  in phases/validators.md. Use when: "validate", "run checks", "/validate",
  or after any structural changes.
related:
  - type: file
    path: .claude/skills/validate/phases/validators.md
    role: "Project-specific validator definitions"
  - type: file
    path: cabinet/_briefing.md
    role: "Scan scopes for validation targets"
---

# /validate — Run All Validation Checks

## Purpose

Run every configured validator and report results in a unified summary.
Zero errors is the standard.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration (run → collect → report) is generic. Your project defines
which validators to run in `phases/validators.md`.

### Phase File Protocol

Phase files have three states:

| State | Meaning |
|-------|---------|
| Absent or empty | Use this skeleton's **default behavior** for the phase |
| Contains only `skip: true` | **Explicitly opted out** — skip this phase entirely |
| Contains content | **Custom behavior** — use the file's content instead |

## Workflow

### 1. Read Validators

Read `phases/validators.md` for the list of project-specific checks.
Each validator has a name, command, and description of what it catches.

**Default (absent/empty):** Auto-discover validators by scanning for
`scripts/*-validator.sh` (or `scripts/*-validator.cjs`). For each found,
treat the filename as the validator name and run it against the
appropriate targets (e.g., `skill-validator.sh` runs against all
`templates/skills/*/SKILL.md` files if they exist, or `.claude/skills/*/SKILL.md`).

If no phase file exists AND no validator scripts are discovered, report
that no validators are configured and suggest the user define some.

### 2. Run Each Validator

Execute each validator command in sequence. For each:
- Run the command
- Capture stdout/stderr and exit code
- Record pass (exit 0) or fail (non-zero) with output

If a validator fails, continue running the rest — don't stop at the
first failure. The point is a complete picture.

### 3. Report

Present a unified summary:

```
## Validation Results

| Check | Status | Details |
|-------|--------|---------|
| {name} | PASS/FAIL | {error count or "clean"} |
| ... | ... | ... |

### Errors
{For each failed check, list the specific errors}
```

If errors found:
- For quick fixes (obvious typo, missing tag): propose the fix
- For complex issues: suggest creating a plan via /plan
- Never silently skip errors

### 4. Terminal State

- All pass → ready to commit and deploy
- Any fail → fix errors and re-validate

## Extending

To add a new validator:
1. Add an entry to `phases/validators.md`
2. Ensure the script/command exists and returns exit 0 on success
3. Run `/validate` to confirm it works

To skip a validator temporarily: comment it out in `phases/validators.md`.

To add a phase the skeleton doesn't define: create a new file in `phases/`
(e.g., `phases/pre-validate.md` for setup steps). Claude reads whatever
phase files exist at runtime.

## Calibration

**Core failure this targets:** Committing or deploying code that has
structural problems (broken references, type errors, lint violations)
because checks weren't run or results weren't reviewed.

### Without Skill (Bad)

Developer makes changes across several files, commits, and deploys.
The deploy fails because of a type error that local checking would have
caught. Or worse: the deploy succeeds but a broken cross-reference
causes a runtime error that isn't discovered for days.

### With Skill (Good)

Developer runs `/validate` after changes. The unified summary shows
one type error and one structural issue. Both are fixed before commit.
The deploy succeeds cleanly. The structural issue would have caused a
subtle bug that wouldn't have surfaced until a user hit a specific
code path.
