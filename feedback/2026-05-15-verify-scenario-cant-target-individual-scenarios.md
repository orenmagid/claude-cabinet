---
type: field-feedback
source: desicify
date: 2026-05-15
component: verify skill (verify:scenario npm script + cucumber.js config)
---

## verify:scenario can't target individual scenarios via positional feature paths

**Friction:** `npm run verify:scenario -- features/<one>.feature features/<another>.feature` silently runs ALL scenarios, not the targeted ones. Tested directly: bare `NODE_OPTIONS='--import tsx/esm' npx cucumber-js --dry-run features/15-signout-route-guards.feature` also returns 17 scenarios (all of them), same as no args. So this isn't npm `--` forwarding — it's cucumber-js v11.2 ignoring positional args when the cucumber.js config has `paths: ['features/**/*.feature']` set. Per cucumber-js docs, positional args should override `paths`; in practice with v11.2 they don't. User has hit this twice now — last time the workaround was `--name`, this time discovered the same.

**Suggestion:** Three paths, any of which would have prevented today's friction:
- (a) Document `--name "<regex>"` (repeatable, OR'd across multiple flags) as the canonical scenario-targeting method in the verify skill's README / cucumber config comment. This is the lowest-cost fix.
- (b) Ship a sibling `verify:scenario-by-name` npm script — e.g. `"verify:by-name": "node scripts/preflight.mjs && NODE_OPTIONS='--import tsx/esm' cucumber-js --name"` so the user just appends `"My Scenario"` and it works.
- (c) Investigate dropping `paths` from the shipped cucumber.js config; if absent, cucumber-js may fall back to positional args correctly. Risk: bare `cucumber-js` runs would then need explicit `features/**/*.feature` from somewhere. The other verify:* scripts use `--tags`, so they're unaffected.

**Session context:** Friendly-launch bundle landed (act:8471cffe ToS/Privacy + act:4d79c6c5 retention). Trying to run a targeted verify on just the touched scenarios (11, 13, 15) before merging to main. Wasted ~10 minutes diagnosing why all 17 ran.
