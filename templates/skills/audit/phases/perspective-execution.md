# Perspective Execution — Running Perspective Agents

Define how to spawn and manage perspective agents during the audit.
The /audit skill reads this file after loading triage suppression.

When this file is absent or empty, the default behavior is: spawn
each selected perspective as a parallel agent following the two-phase
protocol (explore broadly, then rank and emit top 5-8 findings).
To explicitly skip execution, write only `skip: true`.

## What to Include

Define your execution strategy:
- **Agent spawning** — parallel vs sequential, timeout limits, resource caps
- **Context loading** — what each agent receives beyond its perspective SKILL.md
- **Protocol** — how agents should approach their audit (explore-then-rank
  vs checklist vs other)
- **Error handling** — what to do when an agent fails or times out

## Context Loading

Each perspective declares which context files it needs via a `context`
list in its SKILL.md frontmatter. The loading protocol:

1. **Read the perspective's `context` frontmatter field** to get the list
   of context files it needs (e.g., `_context-identity.md`,
   `_context-architecture.md`).
2. **Always load `_context-identity.md`** regardless of whether it's
   declared — every perspective needs project identity.
3. **Load each declared file** from `skills/perspectives/`.
4. **Fallback:** If declared files don't exist, or if the perspective has
   no `context` field in its frontmatter, fall back to reading
   `_context.md` directly. This works for both the hub format (which
   indexes split files) and the old monolithic format (which contains
   everything inline).

This means existing projects with a single monolithic `_context.md`
continue to work without changes.

## Default Protocol

Each perspective agent receives:
1. The perspective's `SKILL.md` — domain knowledge and specific concerns
2. Context files — loaded per the context loading protocol above
3. `skills/perspectives/output-contract.md` — structured output format
4. The suppression list — previously-triaged finding IDs and fingerprints

The agent follows a two-phase protocol:

**Phase A — Explore thoroughly.** Read broadly through the codebase with
this perspective's lens. Take notes on everything observed — patterns,
concerns, healthy subsystems, potential issues. Don't commit to findings
yet. The goal is to see the whole picture before deciding what matters.

**Phase B — Rank and emit.** From everything observed, select the top
5-8 findings that matter most to this project right now. Apply the
output contract (assumption + evidence + question for each). Emit
structured JSON. Include 1-2 positive findings for healthy subsystems.

The two-phase protocol prevents premature commitment. Without it, the
first interesting thing found dominates the output, and deeper or more
important issues are missed.

## Example Override

Uncomment and adapt for your project:

<!--
### Sequential with Timeouts
Run perspectives one at a time with a 3-minute timeout each.
Useful when running on constrained infrastructure.

### Checklist Mode
Instead of explore-then-rank, give each perspective a specific
checklist of things to verify. Faster but less likely to discover
unexpected issues. Good for regression audits where you know what
to check.

### Grouped Execution
Run perspectives in their groups (from _groups.yaml), presenting
results per group before moving to the next. Allows the user to
skip remaining groups if early findings need immediate attention.
-->
