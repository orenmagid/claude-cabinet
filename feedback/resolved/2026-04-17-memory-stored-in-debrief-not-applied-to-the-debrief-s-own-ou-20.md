---
type: field-feedback
source: article-rewriter
date: 2026-04-17
component: /debrief (record-lessons + report phases)
---

## Memory stored in debrief not applied to the debrief's own output

**Friction:** During /debrief, stored a `user_preference` memory via
omega_store: "user's time estimates are overcalibrated, recalibrate
downward." One turn later, composed the debrief report summarizing
filed actions and repeated the exact overcalibrated estimates the
just-stored lesson warned against. User had to catch it and call it
out. omega_store is fire-and-forget — nothing in the workflow forces
re-reading pending output against lessons stored moments earlier. The
memory benefits only the NEXT session (via orient), not the current
one where the lesson was born.

**Suggestion:** Any of: (a) PostToolUse hook on `omega_store` that
echoes the stored lesson as a system reminder, keeping it in-context;
(b) add a step to `/debrief`'s report phase: "before sending, list
lessons stored this debrief and scan the pending report against each";
(c) interleave record-lessons with summary composition — store a
lesson → immediately audit pending framing against it; (d) stronger
orient contract that foregrounds prior-session lessons as active
constraints rather than a passive dump.

**Session context:** de[sic]ify project, end-of-day /debrief after a
feedback + budget-observability shipping session. Caught the miss
in real time, edited the filed actions, re-acknowledged.
