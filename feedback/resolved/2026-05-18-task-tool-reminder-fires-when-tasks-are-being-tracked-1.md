---
type: field-feedback
source: article-rewriter
date: 2026-05-18
component: system-reminder / task-tools
resolution: tracked-upstream
upstream: https://github.com/anthropics/claude-code/issues/62323
resolved-date: 2026-05-27
---

**Resolution:** Out of CC's scope — the system-reminder is built into Claude Code itself. Initially filed as #62800; closed as duplicate of the existing thread #62323 (same reminder text, same triggers, same proposed fix). Tracked there.



## Task-tool reminder fires when tasks ARE being tracked

**Friction:** The "task tools haven't been used recently" system-reminder
fires repeatedly even when TaskCreate/TaskUpdate are being actively used.
Observed ~12 firings across a long /plan + /execute session on 2026-05-18
where multi-step work WAS being tracked via tasks (created 10 tasks
across two batches, updated status throughout the session). The trigger
seems to be "time since last task-tool call" rather than "multi-step
work detected without tasks tracked." Each firing inserts ~50-100 tokens
of identical system-reminder text into context for zero signal — by the
third firing it's just noise that Claude has to consciously ignore in
each response.

**Suggestion:** Tighten the heuristic so the reminder fires only when
(a) no tasks exist OR all tasks are pending/stale AND (b) the recent
action sequence looks multi-step (3+ distinct file edits / tool calls
without a task wrapping them). Or expose a per-session suppression once
Claude has demonstrated task hygiene by creating + completing tasks in
the session.

**Session context:** Multi-action plan+execute arc in the de[sic]ify
project — 5 plan actions filed, 5 executed across 8 commits, with tasks
created at the start of each /execute and marked completed as phases
finished. Task hygiene was good; the reminder added no value past the
first one.
