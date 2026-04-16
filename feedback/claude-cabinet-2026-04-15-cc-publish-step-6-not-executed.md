# /cc-publish Step 6 (update consumers) didn't auto-execute

**Source:** claude-cabinet
**Date:** 2026-04-15
**Component:** skills/cc-publish

The cc-publish skill describes a Step 6 that should iterate `cc-registry.json` and run `npx create-claude-cabinet@latest --yes` in each consumer, then commit each upgrade. When I invoked the skill this session, it published successfully (steps 1-5) but did NOT execute step 6 — I manually ran npx in each of 4 consumers and committed each one separately.

**Possible causes:**
- The skill returns control after npm publish and the assistant treats the task as "done"
- Step 6 instructions may not be emphatic enough about being mandatory
- No clear "transition" prompt from publish-complete → start-rollout

**Suggestions:**
1. Make Step 6 instructions more imperative: "After npm publish completes, IMMEDIATELY iterate cc-registry.json..."
2. Add a final reminder line: "Do not consider /cc-publish complete until all consumers are updated and committed."
3. Investigate whether there's a pattern where multi-step skills tail off after the most "important" step (the publish). May warrant a meta-finding for cabinet-process-therapist.

Discovered during v0.20.0 rollout to 4 consumers.
