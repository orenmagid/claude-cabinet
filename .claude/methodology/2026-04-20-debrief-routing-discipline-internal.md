# Debrief Routing Discipline — Internal Record

**Session:** 2026-04-20
**Release:** Claude Cabinet v0.24.0
**Artifact:** `templates/skills/debrief/phases/record-lessons.md` promoted
to instruction phase; supporting fix to `templates/skills/orient/SKILL.md`
feedback-pipeline check.

## Origin

User noticed article-rewriter's orient was flagging 27 "pending" outbox
items and 5 "wrong-write" `feedback-project-*.md` files. Investigation
revealed: 20/27 outbox items were already delivered but the outbox
flag was never flipped; 4 of 5 project-scoped feedback files described
a multi-password auth system that had been ripped out 7 days earlier
and no forcing function invalidated them. The pattern was rotten.

## Decisions

### The "project-scoped feedback" category doesn't exist

**Claim:** Consumers' invented `feedback-project-*.md` / `scope:
project-specific` pattern doesn't carve a real joint. Every file in
that bucket collapses into (a) a decision, (b) a project constraint,
(c) a conditional revisit, or (d) CC upstream friction embedded in
a project note. There is no fifth thing left over.

**Evidence:** Classified all 5 files in article-rewriter:
- JWT revocation, password-mgmt, RewritePage size → decisions (now
  obsolete — underlying code changed)
- auth-testing, tsc-from-frontend → constraints (one obsolete, one
  still valid)
- Two of the files also contained embedded upstream suggestions
  ("cabinet-qa should flag...", "in nested-package projects...")
  that had nothing project-specific about them

No residue of a genuinely project-scoped-but-not-decision-or-constraint
category emerged.

**Skeptic's critique:** "Maybe some thoughts genuinely are project-
scoped musings that don't fit omega/CLAUDE.md/trigger — retrospectives
on why something didn't work, speculative future-looking notes,
team-context that isn't a decision yet. Forcing them into existing
buckets might cause omega bloat or CLAUDE.md clutter."

**Counter:** The article-rewriter audit was the evidence. Every file
classified cleanly; none were "residue." Even retrospectives fit
the decision slot ("we accepted X outcome because Y"). The decision
tree has an explicit "none of the above? → probably doesn't need
recording" escape hatch for genuine noise, which protects against
bloat. And "team context that isn't a decision yet" is either a
workshop artifact (deserves its own home, not this one) or a
half-formed thought that hasn't earned persistence.

**Off-ramp:** A future audit of consumer projects surfaces a class
of debrief output that doesn't cleanly route — not one-off cases
but a consistent pattern. At that point either add a fifth
destination to the routing tree or reinstate a bounded project-
scoped category with explicit forcing-function requirements.

### Ship as instruction phase, not optional customization

**Claim:** `record-lessons.md` should be promoted from customization
phase (absent-by-default, consumers opt in) to instruction phase
(always ships, joins audit-pattern-capture + methodology-capture +
upstream-feedback). The routing discipline is prescriptive by design.

**Evidence:** Customization-phase version has been shipping for
months; consumers still invented rotting `.md` patterns. Absence of
prescription didn't produce good routing, it produced ad-hoc
categories.

**Skeptic's critique:** "You're overriding consumer autonomy. Different
projects may legitimately have different routing needs — a research
project's decisions may not fit omega at all."

**Counter:** Consumers can still override via `skip: true` or a
custom phase file. The instruction-phase promotion just changes the
default from 'ask what was learned' to 'route per this tree' —
defaults are powerful, but they're still defaults. The customization
door remains open; we're only closing the silent-drift door.

**Off-ramp:** If a consumer reports the routing tree fights their
work (not a one-off; a consistent complaint), move it back to
customization phase and add optional project-scoped-category support
behind a flag.

### Delete obsolete decision files, don't archive them

**Claim:** The 4 article-rewriter files describing defunct systems
(multi-password auth, obsolete size target) were deleted, not
preserved in omega as "historical decisions."

**Evidence:** These weren't historical decisions — they were rotted
decisions presenting themselves as current. Preserving them would
have re-introduced the rot into omega, which has contradiction
detection but can't invalidate something that refers to code that no
longer exists.

**Skeptic's critique:** "You're destroying history. Someone might
want to understand why JWT blocklist was rejected in the old auth
system — that reasoning could inform a future auth system."

**Counter:** The reasoning IS preserved — in git (`cc80b08 Debrief:
feedback files, UX overhaul plan, doc updates for multi-password
auth`). The decision artifact isn't the primary record of the
decision; the git commit that created it is. Additionally, re-
applying that reasoning to a new auth system is reasoning about a
new system, not recall of an old decision — future Claude will do it
on the new facts.

**Off-ramp:** A case where git alone is insufficient for decision
archaeology — e.g., a decision that never got a clean commit, or one
entangled across many. Then archive in omega with `status: archived`
and a note that it's historical.

### Skip-if-exists as the outbox-flush fix (not delete, not mark-delivered-only)

**Claim:** The outbox flush now, before writing each item, looks
for a matching file in `feedback/` or `feedback/resolved/`. If
found, skip the write and mark handled. This is the load-bearing
mechanism that prevents the 27-item desync.

**Evidence:** The bug wasn't that items weren't being delivered —
the 2026-04-12 through 2026-04-18 files existed on disk. The bug
was that the delivery happened in a prior session and the outbox
was never informed. Skip-if-exists is idempotent: you can run
flush arbitrarily many times and it converges.

**Skeptic's critique:** "You're trusting filename collision
detection. If a file was delivered with a slightly different slug
(title mutation between sessions), skip-if-exists won't catch it
and you'll double-deliver."

**Counter:** The slug is derived from the title at outbox-queue
time and at delivery time by the same algorithm — deterministic
from the title. Title mutations between queue and delivery
shouldn't happen because the outbox holds the title verbatim.
Even if one slipped through, the duplicate would be a new file
(-NN suffix), which triage will catch at debrief close-work time.

**Off-ramp:** If duplicate filings become a recurring pattern, add
a content-hash check (first N chars of body) as the matching key
instead of slug.

## What we didn't do (and why)

- **Did not formalize project-scoped feedback as a category.** The
  pattern fails the "is this a real joint?" test.
- **Did not add a hook to block `feedback-project-*.md` writes.**
  Prompt-level anti-pattern callout is the right first layer; hook
  promotion can happen if the callout proves insufficient.
- **Did not build a migration tool.** Cross-repo migration of 5 files
  is not enough evidence to justify a tool; manual migration taught
  us the category collapses to existing routes.
