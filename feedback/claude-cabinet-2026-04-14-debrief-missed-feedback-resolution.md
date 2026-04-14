---
type: field-feedback
source: claude-cabinet
date: 2026-04-14
component: skills/debrief/close-work
---

## Debrief close-work doesn't resolve addressed feedback files

**Skill/phase:** debrief close-work phase (default behavior)
**Friction:** The previous session executed all 12 actions in the Feedback Remediation v3 project, which was explicitly created to address 17 feedback items. The debrief ran but did not delete any of the 17 feedback files in `feedback/`. This session had to manually match each feedback file against the remediation work and delete the 11 that were addressed.
**Suggestion:** The close-work default mentions "Field feedback resolution" but the matching logic isn't reliable enough. After closing actions, debrief should explicitly check: does the closed project's description or notes reference feedback items? If so, present the feedback files and ask which to resolve. Don't rely on commit-message matching alone — the link between feedback and the project that addresses it needs to be explicit.
**Session context:** Starting a session and finding 17 feedback files that should have been cleared by the previous session's debrief.
