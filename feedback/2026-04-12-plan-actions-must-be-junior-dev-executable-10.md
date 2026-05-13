> **NOTE (moved to outbox 2026-04-17):** This feedback was originally
> written to `.claude/memory/feedback/` in article-rewriter — a
> location the current orient skill flags as a wrong-write for CC
> upstream feedback. It was authored 2026-04-12 or 2026-04-13 (see
> frontmatter `date` below) but never delivered upstream because
> the assistant at that time could not invoke `/cc-feedback`. It's
> being moved to the global outbox now so CC can pick it up. **It may
> already have been addressed** in the 4–5 days since it was written;
> CC should verify current state before acting.

---

---
type: feedback
date: 2026-04-12
skills:
  - plan
severity: high
---

# Plan Actions Must Be Junior-Dev Executable

## What Happened

During web app planning (prj:88b9992a), the /plan skill initially
created actions with high-level descriptions like "implement auth"
and "implement prompt assembly" without specifying exact endpoints,
request/response schemas, code structure, or implementation detail.
The acceptance criteria referenced things (like specific endpoints)
that the implementation section didn't describe.

The user had to push back twice ("they seem light on details" and
"imagine you were handing this to a Junior Dev") before the actions
were rewritten with the necessary detail: exact code examples,
endpoint specs, Pydantic models, error handling, and implementation
notes.

## Root Cause

The /plan skill's cold-start readiness check asks: "Could a session
with no prior context execute this plan without re-investigating?"
But the check is applied to the plan file, not to the individual
action notes filed in the work tracker. The plan file had adequate
detail; the action notes were summaries that lost critical specifics.

When actions are filed via pib_create_action, the plan's detail gets
compressed into action notes that are too terse to execute cold. The
filing step (Phase 8) doesn't verify that the action notes preserve
the plan's full implementation detail.

## Suggested Fixes

### /plan skill — Phase 8 quality check

Before filing actions, apply the cold-start readiness check to each
action's notes independently:
- Does the implementation section specify exact endpoints, methods,
  request/response formats?
- Are code examples included for non-obvious patterns?
- Do the acceptance criteria only reference things that are described
  in the implementation section?
- Could a developer with no prior context implement this action
  without asking questions?

The bar: "If a capable developer reads only this action's notes and
nothing else, can they implement it correctly?" If no, the notes are
too terse.
