# Feedback Remediation v2 — Cabinet Critique Record

Filed: 2026-04-13
Plan: `.claude/plans/feedback-remediation-v2.md`
Critics: architecture, qa, process-therapist, anthropic-insider, workflow-cop, boundary-man

## Status

Plan is CONDITIONAL from all 6 critics. Core issue: plan diagnoses
structural problems but prescribes compliance-layer fixes. Needs revision
to promote highest-impact items to structural enforcement (hooks, tools,
scripted commands) before implementation.

**BLOCKED on:** Need a review UI to do itemized triage of findings before
revising. Building that first.

---

## Core Diagnosis (unanimous)

The plan's own Problem section says "compliance-layer instructions
(~60-80% adherence) are doing the work of structural enforcement (~100%)"
— then 12 of 14 items add compliance-layer instructions. Every critic
caught this independently.

---

## Architecture (CONDITIONAL)

### Concerns
1. Plan/Execute detail loss is all compliance, no structure — feedback explicitly says compliance isn't enough. Plan adds SKILL.md text for 6/6 Pattern A items. Internally inconsistent.
2. Convention check (6e) placement is correct but needs explicit triggering criteria — "2+ files that serve requests" suggested.
3. **BLOCKING:** Feedback pipeline path 3 (assistant writes to wrong location like `.claude/memory/feedback/`) is unaddressed. Orient outbox flush should scan common wrong-write locations.
4. LSP plugin recommendations in execute/cc-health are architecturally correct placement.
5. Orient omega query could be scripted (execute the bash command mechanically) rather than instructed (tell Claude to do it).
6. Item 2d (surface_memories verification) recommendation is correct but needs concrete verification criteria defined.
7. No shared convention for "mandatory step" across skills — plan introduces MANDATORY in 3 skills without a convention. Risk of drift.
8. No coupling violations — the 6 file changes are independent. Positive.

### Suggestions
- Keep SKILL.md text changes as immediate fix for Pattern A, but name the hook each would become. PostToolUse on pib_create_action for quality validation, PreToolUse on pib_complete_action for spec verification.
- Convention check 6e: define triggering criteria concretely.
- Feedback flush: add wrong-path scanning to orient.
- Orient omega: execute query as bash command in default behavior, not prose instruction.

---

## QA (CONDITIONAL)

### Concerns
1. Manual AC paradox — 14/16 ACs are [manual], verifying only that text was added to files. All 14 could be [auto] grep checks. But neither manual nor auto tests whether the text actually changes behavior.
2. Text-as-enforcement for problems caused by text-as-enforcement — 1d, 1e, 2b are all stronger SKILL.md language for things that already had SKILL.md language that was ignored. Zero items move enforcement up the compliance stack (except 2d which considers it).
3. Deviation AC is self-referentially unverifiable — the session that deviated judges whether it deviated. Same ~60-80% compliance.
4. Proportionality gap — type-check-after-extraction + verify-props-before-use + read-full-notes creates overhead on small changes. No scope qualifiers.
5. Missing ACs: no regression test (re-run a feedback scenario), no feedback-loop-closure test (verify flushed items appear in feedback/), no execute-side deviation enforcement, no LSP availability verification, no conflict-between-1e-and-1f test.
6. Auto-memory/omega conflict dismissed too quickly — orient could detect when file-based memory was used instead of omega.

### Suggestions
- Convert all 14 manual ACs to auto grep checks, then add behavioral smoke test ACs.
- Promote 3+ items to hooks: PreToolUse on pib_complete_action, PostToolUse tsc on .tsx files, omega query as scripted.
- Add scope qualifiers: "when change touches fewer than 3 files and no extraction, type-check/prop-verify are advisory."
- For deviation AC: add mechanical complement — check if files in downstream surface areas were modified.
- Add smoke-test AC: re-run one original feedback scenario through updated skills.

---

## Process-Therapist (CONDITIONAL — harshest critique)

### Concerns
1. **CRITICAL:** Plan contradicts its own diagnosis. 12/14 items add compliance-layer text. Enforcement pipeline doc says "structural encoding that makes the wrong thing impossible." Plan ignores this for 12/14 items.
2. Feedback loop broken in 3 ways; plan fixes the cheapest one. Outbox fix is itself compliance-layer (orient needs to remember to check it). A cron, hook, or debrief structural flush would be more reliable.
3. Plan is too large — 4 workstreams, 14 changes, 16 ACs, all manual. No measurement. Treats all feedback with equal weight.
4. Success case not analyzed — plan-critique-caught-auth-gaps worked because: narrow mandate, concrete task, natural checkpoint, blocking escalation. Failures share opposite pattern: broad instruction, ambient task, no checkpoint. Plan adds more broad ambient instructions without checkpoints.
5. No measurement mechanism — no way to know if any change worked.

### Suggestions
- Pick 3 items where enforcement level can actually change. Orient omega query (hook), execute spec read (pib_complete_action hook or pib_get_action tool), feedback outbox (SessionStart hook or debrief structural step).
- Fix feedback pipeline first — it's the meta-system.
- Add measurement to whatever ships.
- Shrink to 3-5 changes, make 2+ structural, measure over 2 weeks, then next batch.
- Study success case and replicate: narrow mandate + concrete task + natural checkpoint + blocking escalation.

---

## Anthropic Insider (CONDITIONAL)

### Concerns
1. **HIGH:** LSP should be primary fix for code-level items, not a recommendation. TypeScript LSP plugin confirmed working. Missing imports and invalid props caught automatically. Items 1e/1f should be structural (LSP) with text as fallback. Drop 1f entirely if LSP active.
2. **HIGH:** surface_memories diagnosis is incomplete. Hook fires and works but searches by file path, not behavioral context. "Never guess in browser automation" doesn't match filenames. Root cause of "memories loaded but not applied" is semantic mismatch, not hook failure. Two options: (a) enhance surface_memories to search by intent (omega-level change), or (b) accept gap and add PreToolUse prompt hook for high-risk domains.
3. **MODERATE:** Hook opportunities missed. PreToolUse prompt hook on pib_complete_action (highest value). SessionStart command hook for outbox notification. Type-check hook superseded by LSP.
4. **LOW:** disable-model-invocation removal correct. Also fix quoted-string-vs-boolean bug ('true' string vs true boolean). Opaque error is platform UX issue worth reporting.
5. **LOW:** hookify plugin exists in official marketplace — relevant for consuming projects creating behavioral hooks from friction patterns. Plan doesn't mention it.

### Suggestions
- Restructure: LSP primary for 1e/1f, SKILL.md text as non-LSP fallback only.
- Document surface_memories diagnosis explicitly. The hook works mechanically but file-path search doesn't match behavioral memories.
- Add PreToolUse prompt hook for pib_complete_action as highest-value hook.
- Consider SessionStart hook for outbox check.
- Reference hookify plugin for consuming projects' enforcement pipeline promotion step.
- Note: pyright-lsp, gopls-lsp, rust-analyzer-lsp etc. all exist. Execute should recommend language-appropriate LSP, not just TypeScript.

---

## Workflow-Cop (CONDITIONAL)

### Concerns
1. **HIGH:** Debrief-to-orient continuity gap. Plan covers plan→execute and orient→session, but debrief→orient is the backbone. Who verifies what debrief records is what orient needs? If surface_memories hook IS working and memories still don't stick, the problem is context decay over session. Plan should commit to diagnostic sequence, not frame Option A as fallback — evidence suggests it's needed.
2. **HIGH:** Deviation AC has no enforcer. Execute Step 7 walks through ACs, but the session that deviated judges whether it deviated. Fox guards henhouse. Should be structural gate (diff plan interfaces vs actual implementation) or explicitly accept ~60-80% with documented promotion path.
3. **MODERATE:** Outbox flush too narrow. Only CC source repo flushes. Consuming projects should flush via cc-registry.json CC path. Count-only notification becomes noise.
4. **MODERATE:** Plan ephemeral file problem partially addressed. Quality gate is compliance. Should include promotion path: "if quality gate fails after 3+ sessions, promote to structural (auto-delete plan file after filing)."
5. **MODERATE:** Execute missing deviation propagation step. At Step 8, mechanically check downstream actions' surface areas against files modified in this action. Flag for review.
6. **LOW:** LSP should be warning-level health finding in cc-health, not informational.

### Suggestions
- Define explicit debrief-to-orient contract: what debrief MUST record for orient to function.
- Make deviation propagation mechanical in execute Step 8.
- Let consuming projects flush outbox via registry path.
- Add promotion paths to compliance-layer items.
- Commit to diagnostic sequence for memory persistence (verify hook → if working but decays → point-of-use re-injection).

---

## Boundary-Man (CONDITIONAL)

### Concerns
1. **HIGH:** `pib_list_actions` doesn't include notes column at all. Execute literally can't read specs through the standard tool. This is a data availability failure, not compliance. Fix: add `pib_get_action` MCP tool returning full record.
2. **MODERATE:** Outbox race condition — flat JSON array, no file locking, concurrent writers cause data loss. Malformed entries from consuming projects make entire outbox unreadable. Need try/catch, atomic write, empty-array reset.
3. **HIGH:** SKILL.md size vs compliance. plan/SKILL.md at 432 lines, adding ~70 more pushes toward 510+. Diminishing returns — more rules compete for attention. The plan's most important rule (1d — read full spec) has same skip probability as lowest-value rule. Promote top 3-4 to structural, defer rest.
4. **LOW:** Deviation AC (1c) could conflict with consuming projects that have custom `phases/work-tracker.md` with their own AC structure. Low risk since AC is just appended text.
5. **LOW:** LSP plugin degrades gracefully — recommendation only, nothing breaks if binary not installed.
6. **HIGH:** surface_memories hook output competes with tool output for attention and loses. PostToolUse output has lower attention weight. High-severity memories should use PreToolUse (before action, in decision window) or result-field injection, not PostToolUse print.

### Suggestions
- Add `pib_get_action` MCP tool — makes "load full spec" a one-tool-call operation.
- Outbox: parse with try/catch, atomic write (temp file + rename), empty-array reset.
- Promote top 3-4 SKILL.md rules to structural. Cut or defer rest to avoid bloat.
- For prevent-type memories: PreToolUse hook or result-field injection instead of PostToolUse print.
