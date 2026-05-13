---
type: field-feedback
source: desicify
date: 2026-04-26
component: .claude/skills/execute/SKILL.md (Phases 6-7)
---

## Execute breadcrumb commit-ordering ambiguity

**Friction:** The skill creates the verification breadcrumb at Phase 1
with `ac_verified: false`, then says to commit after Checkpoint 3
(Phase 6), then verify ACs (Phase 7), then update the breadcrumb. In
practice this means the breadcrumb gets committed in the work commit
at `ac_verified: false`, then updated post-commit, and a follow-up
commit is needed to land the `ac_verified: true` state.

**Suggestion:** Pick a side — either:
1. **Move AC verification before the commit** (Phase 7 runs before
   Phase 6's commit), so the breadcrumb is `ac_verified: true` when
   committed. Cleanest narrative: "verify ACs, then commit the work
   plus the verified breadcrumb in one shot."
2. **Have the skill stage the breadcrumb update with the work commit
   explicitly**, e.g., add a sub-step after Phase 7: "Amend the last
   commit to include the breadcrumb update" or "Stage the breadcrumb
   update for inclusion in the next commit." Either is fine; just be
   explicit.
3. **Document the follow-up commit as expected** in the skill prose,
   so operators don't think they did something wrong when they end up
   with two commits per /execute invocation.

The current state — silent assumption that operators will "figure out"
the right commit-ordering — is the worst of the three.

**Session context:** act:f48920bd Tier 1 fidelity-critic prompt work,
2026-04-25. Needed an extra commit (9e321c5 "Tier 1 fidelity critic:
verify ACs (act:f48920bd post-ship breadcrumb)") just to persist
`ac_verified: true` after Phase 7 finished. Three lines changed, one
extra commit on the log — minor noise, but cumulative across invocations
it muddies the git history with bookkeeping commits that look like real
work in `git log --oneline`.

The skill is otherwise excellent — the cabinet-checkpoint protocol
caught real issues this session (anti-confirmation review of both Tier
1 and Tier 2 produced 6 pre-commit fixes between them). The friction
is purely in the breadcrumb sequencing, not the skill's substance.
