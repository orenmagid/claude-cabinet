# Member Execution — Running Cabinet Member Agents

Define how to spawn and manage cabinet member agents during the audit.
The /audit skill reads this file after loading triage suppression.

When this file is absent or empty, the default behavior is: spawn
each selected cabinet member as a parallel agent following the two-phase
protocol (explore broadly, then rank and emit top 5-8 findings).
To explicitly skip execution, write only `skip: true`.

## What to Include

Define your execution strategy:
- **Agent spawning** — parallel vs sequential, timeout limits, resource caps
- **Context loading** — what each agent receives beyond its cabinet member SKILL.md
- **Protocol** — how agents should approach their audit (explore-then-rank
  vs checklist vs other)
- **Error handling** — what to do when an agent fails or times out

## Briefing Loading

Each cabinet member declares which briefing files it needs via a `briefing`
list in its SKILL.md frontmatter. The loading protocol:

1. **Read the cabinet member's `briefing` frontmatter field** to get the list
   of briefing files it needs (e.g., `_briefing-identity.md`,
   `_briefing-architecture.md`).
2. **Always load `_briefing-identity.md`** regardless of whether it's
   declared — every cabinet member needs project identity.
3. **Load each declared file** from `cabinet/`.
4. **Fallback:** If declared files don't exist, or if the cabinet member has
   no `briefing` field in its frontmatter, fall back to reading
   `_briefing.md` directly. This works for both the hub format (which
   indexes split files) and the old monolithic format (which contains
   everything inline).

This means existing projects with a single monolithic `_briefing.md`
continue to work without changes.

## Default Protocol

Each cabinet member agent receives:
1. The cabinet member's `SKILL.md` — domain knowledge and specific concerns
2. Briefing files — loaded per the briefing loading protocol above
3. `cabinet/output-contract.md` — structured output format
4. The suppression list — previously-triaged finding IDs and fingerprints

The agent follows a two-phase protocol:

**Phase A — Explore thoroughly.** Read broadly through the codebase with
this cabinet member's lens. Take notes on everything observed — patterns,
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
Run cabinet members one at a time with a 3-minute timeout each.
Useful when running on constrained infrastructure.

### Checklist Mode
Instead of explore-then-rank, give each cabinet member a specific
checklist of things to verify. Faster but less likely to discover
unexpected issues. Good for regression audits where you know what
to check.

### Grouped Execution
Run cabinet members in their committees (from committees.yaml), presenting
results per committee before moving to the next. Allows the user to
skip remaining committees if early findings need immediate attention.
-->
