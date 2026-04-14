---
type: feedback
date: 2026-04-12
skills:
  - plan
  - execute
severity: moderate
---

# Plans Need Built-In Deviation Safeguards

## What Happened

During web app planning (prj:88b9992a), the user identified that if
implementation deviates from the plan in one action, downstream actions
still reference the original assumptions. A junior dev implementing
Phase 2 based on Phase 1's plan would be working from stale specs if
Phase 1's implementation changed interfaces, added/removed endpoints,
or took a different approach.

The user had to explicitly request that every action include an AC:
"If implementation deviated from this plan, all downstream actions
were reviewed and updated before marking this action complete."

## Root Cause

Neither /plan nor /execute have a built-in mechanism for plan
deviation tracking. /plan creates actions with detailed specs but
assumes they'll be executed exactly as written. /execute (if it has
checkpoint logic) doesn't verify that the current action's
implementation matches what downstream actions expect.

Plans are living documents — deviation is normal and expected. But
deviation without propagation creates stale specs that waste the
next session's time.

## Suggested Fixes

### /plan skill — auto-include deviation AC

Every action created by /plan should automatically include:
"[manual] If implementation deviated from this plan, all downstream
actions in this project were reviewed and updated to reflect the
actual state before marking this action complete."

This should be injected by the plan skill, not left to the user to
request.

### /execute skill — deviation check at action completion

When marking an action complete, /execute should:
1. Ask: "Did implementation deviate from the plan in any way?"
2. If yes: read downstream actions, identify which ones reference
   interfaces/APIs/files that changed, and update them.
3. This prevents stale specs from surviving across sessions.
