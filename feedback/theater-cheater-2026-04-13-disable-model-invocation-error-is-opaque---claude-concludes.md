---
type: field-feedback
source: theater-cheater
date: 2026-04-13
component: Skill tool / disable-model-invocation
---

## disable-model-invocation error is opaque — Claude concludes skill doesn't exist

**Friction:** User asked for `/cc-feedback`. The Skill tool returned `disable-model-invocation` error with no explanation. Claude then searched for skill files via Glob (wrong paths), concluded the skill didn't exist, and told the user it wasn't installed. The skill was installed the whole time — `disable-model-invocation` means "read SKILL.md and follow the instructions directly" but the error message doesn't say that. User had to show a screenshot of the skill menu proving it exists.

**Suggestion:** The error message should say something like: "cc-feedback has disable-model-invocation set. Read the SKILL.md directly at [path] and follow its workflow." Or better: the Skill tool could automatically fall back to reading and following the SKILL.md when this flag is set, instead of erroring.

**Session context:** User wanted to file friction feedback about multiple issues encountered during a probe bug-fix session.
