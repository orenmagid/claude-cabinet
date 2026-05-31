---
type: field-feedback
source: flow
date: 2026-05-30
component: claude-code-platform (system-reminder behavior)
---

## Mid-skill user message causes assistant to rush/truncate running skill

**Friction:** When a user sends a message while a long-running skill (like /orient) is executing, a system reminder appears with urgent "MUST" framing: "IMPORTANT: After completing your current task, you MUST address the user's message above. Do not ignore it." This pressures the assistant to panic-finish the current skill — skipping phases, truncating output, and collapsing multi-phase workflows into a rushed summary. In this case, /orient skipped health checks, articulation sweeps, prep scout, cabinet consultations, feature spotlight, and the skills menu.

**Suggestion:** The system reminder should use non-urgent framing like "The user sent a follow-up message — address it after completing your current skill." The user's message isn't going anywhere. Skills have phases for a reason, and the assistant shouldn't be incentivized to abandon them. Alternatively, the reminder could be suppressed entirely while a skill is actively executing — the assistant will naturally see the queued message when the skill completes.

**Session context:** User invoked /orient, then sent a message about a meeting transcript mid-orient. The system reminder caused orient to skip ~6 phases and deliver a truncated briefing.
