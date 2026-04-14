---
type: field-feedback
source: theater-cheater
date: 2026-04-13
component: orient/context phase
---

## Orient doesn't surface deployment method

**Friction:** Orient loaded status files, plan, memories, and patterns but never surfaced how the project deploys. When it was time to ship a fix, Claude tried `git push` (no remote configured) instead of `railway up --detach`. The deployment method is critical operational context — without it, the first deploy attempt in every session fails.

**Suggestion:** Orient's context phase could check for deployment indicators: `git remote -v`, `railway status`, presence of Dockerfile/deploy scripts, CI config. Surface the deploy command in the briefing under a "Deployment" heading. This is a one-line addition to the briefing that prevents a guaranteed failure mode.

**Session context:** Fixed 3 probe bugs (rollover detection, days-out mismatch, meaningless furthestExisting), needed to deploy to Railway.
