---
type: field-feedback
source: article-rewriter
date: 2026-04-18
component: cabinet subagent authoring guidance (general CC convention)
---

## Prompt pattern is a first-class design dimension when a CC skill uses a subagent for review or evaluation

**Friction:** When a CC skill delegates quality review, evaluation, or audit work to a subagent, the common framing is "define the rubric and let the reviewer apply it." The Phase 3 ST pilot in article-rewriter demonstrated this framing is incomplete: the same rubric applied by the same subagent type can produce opposite outcomes depending on how the reviewer is instructed to *apply* it. A lenient prompt ("default to PASS when in doubt") produced 50/50 PASS on a 10-entry sample with one tool call and zero FAIL reasoning — a pure rubber-stamp. An adversarial prompt ("identify a candidate weakness per check before committing to PASS") on the same sample surfaced 2 defensible FAILs that were specific, fixable, and independently confirmed. Same rubric, opposite outcomes.

**What "prompt pattern" means, concretely:** The rubric is *what* gets checked (e.g., the 5 faithful-merge checks: action preservation, no contradiction, pass-tag defensibility, scope fidelity, citation preserved). The prompt pattern is *how* you instruct the reviewer to apply those checks — whether they're told to steelman the work, challenge it, skim it, or weigh it. Weakness-first framing (the reviewer must name a candidate weakness per check before they can vote PASS) produces rigorous review. Leniency-first framing ("default to PASS when in doubt") produces rubber-stamp. The difference isn't in what's being checked, it's in the epistemic posture the reviewer adopts.

**Suggestion:** CC's subagent-authoring guidance (wherever that lives — cabinet-member SKILL.md conventions, the cc-feedback/audit/triage-audit/execute skills that use subagents for review, or a dedicated CC doc page) should treat prompt pattern as a first-class design decision alongside rubric. Specifically:

1. Document the rubber-stamp failure mode explicitly so skill authors know to test for it.
2. Recommend the adversarial pattern as default for any skill whose subagent gates quality (audit triage, calibration, code review, finding triage).
3. Suggest a two-pass structure for high-stakes reviews: a lenient run first (baseline — expect rubber-stamp) and an adversarial run second (discrimination — expect real findings). The delta between them is diagnostic; if they agree, either the work is genuinely clean OR the rubric has a blind spot that no prompt will expose.
4. Propose a small convention inside SKILL.md files that use subagents for review: a `review-prompt-pattern:` field in frontmatter that names the intended posture (adversarial | lenient | exploratory), so authors are forced to choose deliberately.

**Session context:** Phase 3 ST pilot of the medico-legal framework extension in article-rewriter. Two-pass calibration harness with 10-entry stratified sample. First pass lenient, second pass adversarial. Cross-pass cell-level agreement was 96% (passes ≥90% threshold) — but the agreement hid that the first pass was nearly content-independent rubber-stamp and the second pass did actual work. Without running both, we would have shipped the rubber-stamp result as a "passed calibration" and missed the two real FAILs. The lesson generalizes: any CC skill using a subagent for evaluation is vulnerable to the same failure mode. Full method record at framework/medical-legal/audit/phase-3-st-pilot-method.md §8.
