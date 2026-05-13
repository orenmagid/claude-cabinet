---
type: field-feedback
source: article-rewriter
date: 2026-04-19
component: cabinet-record-keeper
---

## Record-keeper debrief consultation ran 7x over the 2-minute budget

**Skill/phase:** `cabinet-record-keeper` standing-mandate debrief pass
(invoked from `/debrief` phase 3, cabinet consultations)

**Friction:** The debrief skill explicitly says "each agent should
complete in under 2 minutes" for standing-mandate passes. In this
session, `cabinet-record-keeper` ran for **952,545 ms (~15.9 min)** —
roughly 7x the stated budget. It did useful work (updated CLAUDE.md,
system-status.md, `_briefing-architecture.md` to reflect three shipped
actions + new components), but the long runtime stalled the whole
debrief and prompted the user to check on me (`you ok?`) mid-flow.

The other debrief-mandate agent (`cabinet-historian`) completed in
~58s, well within budget. So the overrun isn't inherent to the
standing-mandate pattern — it's specific to record-keeper when the
session has substantial new surface area (new components, new
endpoints, new docs).

**Possible causes:**
- Record-keeper's scoping is open-ended ("check every doc in the
  project" when the project has grown). Scales poorly.
- The task included *both* staleness-checks AND additions
  (new components to document). The skeleton's division-of-labor note
  (`phases/update-state.md`) says record-keeper owns both, but when
  additions are substantial, that's more like implementation work than
  a consultation pass.

**Suggestion:** Either
1. Tighten the record-keeper debrief directive to read-only
   staleness-check only, and move doc *additions* back to a later
   update-state phase with explicit scope, OR
2. Give record-keeper a hard timeout (e.g. 3 min wall clock) and have
   it report "too much work — needs a follow-up action" if it can't
   finish.

Net: when the user has to ask if you're OK, something is wrong.

**Session context:** Closing out the Budget & Tips project — three
actions shipped (user UI, Polar checkout, webhook handler), plus new
`/dev` skill, new MCP integration, new testing runbook. Record-keeper
had to verify + update three different documentation surfaces against
all of this.
