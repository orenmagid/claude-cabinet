---
type: field-feedback
source: claude-cabinet
date: 2026-04-11
component: skills/cabinet-anthropic-insider/SKILL.md
severity: high
---

## Anthropic insider recommended adopting a platform feature that doesn't work

**Friction:** The cabinet-anthropic-insider member recommended adopting
compaction hooks (PreCompact/PostCompact) as part of the Platform Feature
Adoption project. The recommendation was accepted, a PreCompact prompt
hook and SessionStart recovery hook were designed, built, shipped in
v0.15.0, and deployed to all 3 consumers (flow, article-rewriter, CC
dogfood). The hooks did nothing — they have been silently failing since
deployment.

**Root cause:** PreCompact prompt hooks cannot take actions. Prompt hooks
are single-turn policy evaluations with no tool access — they can return
a yes/no decision but cannot write files, run commands, or do anything
else. PreCompact doesn't even have decision control, so even the yes/no
response is discarded. The anthropic-insider should have known this
before recommending adoption. This is a fundamental platform limitation,
not a bug — GitHub issues #43733 and #36749 are open feature requests
asking Anthropic to add agentic PreCompact hook support.

**Impact:** Wasted design, implementation, testing, and deployment time
across 4 repos. Every compaction event in every consumer since v0.15.0
has fired a useless hook and reported "no compaction state found" — a
false signal that masks the real problem (no state was ever saved).

**What should have happened:** The anthropic-insider should have verified
that PreCompact prompt hooks can actually take actions before recommending
them. A 5-minute test or reading the CC hooks documentation would have
revealed the limitation. The member's orient directive says "flag any new
capabilities or breaking changes" — it should also verify that
recommended capabilities actually work as expected before they get built.

**Remediation:**
- Removed PreCompact prompt hook, SessionStart recovery hook, and both
  template files from CC source
- Cleaned settings.json and .ccrc.json manifests in all 3 consumers
- Removed installed hook files from all consumers

**Additional failure:** The original plan identified the problem as "the
empty SessionStart/PostCompact hooks in settings.json are unused" but
the solution never included a PostCompact workstream. Only PreCompact +
SessionStart were designed. PostCompact was left as an empty `[]` in
settings.json across all consumers — a placeholder that was never
filled. So the feature was both incomplete (no PostCompact) and broken
(PreCompact can't do anything).

**Suggestion:** The anthropic-insider cabinet member needs a verification
mandate: before recommending adoption of any platform feature, it must
confirm the feature works as described by testing it or citing
authoritative documentation. "The changelog says X exists" is not the
same as "X works for our use case." Additionally, the /plan skill's QA
phase should catch plans that reference platform capabilities without
verifying they actually work — the plan even noted "Verification needed"
for the SessionStart matcher syntax but never asked the more fundamental
question: can PreCompact prompt hooks take actions?
