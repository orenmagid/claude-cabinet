# Audit Pattern Capture

Runs after cabinet consultations (step 3) and before recording lessons.
Detects recurring audit findings and writes them to the relevant cabinet
member's `patterns-project.md` file.

## When This Runs

After cabinet members have completed their debrief consultations. This
phase consumes what they produced — it doesn't run cabinet members itself.

## What to Do

### 1. Collect This Session's Audit Findings

If an audit ran this session (check for audit output in the session's
work), collect the findings by cabinet member. If no audit ran, skip
this phase entirely.

### 2. Check for Recurrence

For each cabinet member that produced findings this session, check
whether the same CLASS of finding has appeared before:

- Check triage history if available:
  ```bash
  node scripts/pib-db.mjs triage-history 2>/dev/null
  ```
  Look for approved findings from the same cabinet member with similar
  descriptions.

- Check the member's existing `patterns-project.md` if it exists —
  is this finding already captured?

**A pattern is recurring when:** The same cabinet member flags the same
class of issue (not identical text, but the same underlying problem)
in 2+ separate audit runs. One-time findings stay as findings; recurring
ones become patterns.

### 3. Write to patterns-project.md

For each newly detected recurring pattern, append it to the member's
project pattern file:

**Path:** `.claude/skills/cabinet-{member-name}/patterns-project.md`

Create the file if it doesn't exist. Append if it does.

**Entry format:**
```markdown
### [Short pattern name]

**Occurrences:** [N] times across [N] audits (first: YYYY-MM-DD, latest: YYYY-MM-DD)

[1-2 sentence description of the pattern — what the issue is and why
it recurs. Be specific enough that the cabinet member can detect it
in future audits without re-reading the original findings.]
```

### 4. Surface Pattern Promotion Candidates

After writing project patterns, check if any patterns in
`patterns-project.md` look universal (not specific to this project's
domain, codebase, or technology choices). If so, note them for the
CC feedback phase — they may be candidates for upstream promotion.

Signals that a pattern is universal:
- It describes a general coding practice, not a project-specific convention
- It would apply to any project using the same technology
- The pattern name doesn't reference project-specific entities

Do NOT auto-promote. Just surface the candidate so the CC feedback
phase can decide whether to file it.

## What NOT to Do

- Don't capture one-time findings as patterns
- Don't duplicate patterns already in `patterns-project.md`
- Don't modify the upstream SKILL.md section — that's CC-owned
- Don't create `patterns-project.md` for members with no recurring findings
