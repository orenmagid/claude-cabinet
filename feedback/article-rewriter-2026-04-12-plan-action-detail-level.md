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
