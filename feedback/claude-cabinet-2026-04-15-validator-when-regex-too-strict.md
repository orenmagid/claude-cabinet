# Validator description-when regex too strict on word adjacency

**Source:** claude-cabinet
**Date:** 2026-04-15
**Component:** scripts/skill-validator.sh

The `description-when` check requires trigger words (`when`/`during`) to immediately follow the activation verb (`Activates`/`Activated`). Phrasings like `Activates throughout sessions when X` fail because `throughout` breaks the regex match.

This produced a confusing failure in flow's cabinet-life-tracker — the description contained both `Activates` and `when` in the same sentence but they weren't adjacent. Took a cycle to diagnose.

**Suggestions:**
1. Loosen the regex to allow up to a few words between the verb and trigger: `Activate(s|d)?\s+(\w+\s+){0,3}(when|during)`
2. Add common variants to the alternation (`Activates throughout`, `Activates whenever`)
3. Improve the failure message to explain the adjacency requirement so users don't waste a cycle figuring it out

Discovered while applying the new validator to flow's 5 custom cabinet members during the v0.20.0 rollout.
