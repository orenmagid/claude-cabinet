---
type: field-feedback
source: article-rewriter (de[sic]ify)
date: 2026-04-17
component: debrief skill / cabinet consultations phase
---

## Debrief's step-3 cabinet-consultations phase is easy to skip

**Friction:** During a long (~8-hour) session's `/debrief`, I went through the phases in order but silently skipped step 3 (cabinet consultations). The skill documents that step 3 should spawn cabinet members whose `standing-mandate` includes `debrief` — and cabinet-record-keeper's SKILL.md frontmatter explicitly sets `standing-mandate: debrief`. So cabinet-record-keeper SHOULD have been invoked to audit documentation staleness and fill gaps. It wasn't.

User caught the omission by asking "doesn't CC ship with someone to help with this? shouldn't that someone automatically be invoked in debrief?" — correctly identifying that the record-keeper exists AND that debrief is its trigger.

**Root cause:** Step 3 is prose in the skill; it relies on the model reading the skill, parsing the discovery logic (`_index.json` filter for `standingMandate: debrief`), spawning the right sub-agents with the right directives. Under session-fatigue conditions the model compresses — skips "cheap-seeming" phases to close faster. Result: a phase that the skill specifies as non-skippable de facto skips.

**Severity:** Moderate. The record-keeper's job isn't load-bearing for session close (no data loss occurred), but documentation staleness DOES accumulate silently when debrief's record-keeper pass gets skipped across sessions. Multiply by N sessions and you get a divergence between code and docs that only surfaces later.

**Suggestion:**
1. **Harness-enforced invocation.** A debrief-start hook (Stop-event or similar) could parse `_index.json` for debrief-mandated cabinet members and enforce their spawn as a pre-condition of debrief completion. Failure to invoke = debrief doesn't close.

2. **Skill-level blocking phase.** Rewrite step 3's prose from "spawn cabinet members" to "**BLOCKING:** invoke cabinet members before continuing. If no members have a debrief mandate, explicitly note that. If the invocation fails, surface and stop." Right now the phase reads like "do this if you remember" — making it blocking changes the model's behavior under fatigue.

3. **Verification pass inside debrief.** After all phases complete, verify that cabinet-mandated members were actually spawned (check agent-tool history). If not, report to user before the final summary.

**Session context:** Large medico-legal synthesis foundation session. Produced 35 files across Phases 0-2 of a multi-phase plan. Debrief ran at the end; user flagged the omission during the final report review. Record-keeper was invoked manually after the user's prompt to retroactively handle its job.


---

## Additional root cause (added 2026-04-17 post-filing)

Session fatigue isn't the full story. A more specific cause: **user-provided scope hints can silently override the skill's own phase spec.**

The user invoked debrief with 'making sure to close out, clean up, and only commit relevant files, please' — three concrete tasks. Under session fatigue, I treated that as the debrief spec rather than as emphasis within a larger specified workflow. Cabinet consultations felt like scope creep relative to those three asks, so I silently deprioritized the step-3 phase. The user's scope hint effectively narrowed the skill's own definition of 'done.'

The proposed harness/blocking-marker fixes solve the symptom — they'd force the step-3 phase regardless of how my attention got narrowed. But the underlying pattern is broader: **user scope hints can nullify skill phases, and the model doesn't always notice when that's happening**. This affects other multi-phase skills too (orient, audit, plan) under the same pressure.

**Broader suggestion:** When a skill with required phases receives user-provided scope emphasis, the skill should acknowledge the user's emphasis explicitly but also explicitly preserve the required phases. Something like:

> 'Noted: close-out, clean-up, commit are your priorities. I'll still run all required debrief phases; those three will just get extra attention during the reporting summary.'

That surfaces the tension instead of silently resolving it in favor of user-emphasis. And it gives the user an opportunity to say 'actually skip phase X this time' explicitly rather than inadvertently.


---

## Further refinement (added 2026-04-17, after user response)

User's actual intent behind the scope hint wasn't narrowing — it was **a safety net against known skipping behavior**. Their words: 'It's funny, because I said that to emphasize those, not to say don't do the others. It's because I know you don't always do everything, lol.'

This inverts the prior framing. The user emphasized 'close out, clean up, commit' specifically BECAUSE they know I skip things. Their emphasis was defensive — an attempt to ensure those specific phases got attention. But I interpreted it as permission-to-narrow and used the safety net as cover to skip OTHER phases (the cabinet consultations they didn't mention, probably because they trusted the skill to specify them).

So the pattern is worse than 'user scope hints narrow model focus.' It's:
1. User, aware that model skips phases, emphasizes specific ones as insurance
2. Model interprets the emphasis as narrowing scope
3. Model skips other phases using the emphasis as permission
4. The user's anti-skipping strategy becomes the exact mechanism by which more skipping happens

**Implication:** 'emphasize-these-don't-forget' user patterns are a high-risk zone. The model should treat such emphasis as a DEFENSIVE SIGNAL (flagging concern about full completion) rather than a SCOPE-LIMITING SIGNAL. In practice: when the user emphasizes a subset of a multi-phase skill, the model should explicitly expand scope back to the full skill phase list + give the emphasized items extra attention in the report, not shrink the phase list to match the emphasis.

This re-strengthens the case for harness-enforced invocation or BLOCKING skill phases — those solve the problem regardless of how the model misreads user intent.
