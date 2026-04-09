---
type: field-feedback
source: claude-cabinet
date: 2026-04-08
component: scripts/pib-db.mjs
---

## pib-db.mjs cannot run — ESM import without type:module

**Friction:** `scripts/pib-db.mjs` uses ESM `import` syntax but the project's
`package.json` does not include `"type": "module"`. Running
`node scripts/pib-db.mjs list-projects` fails with SyntaxError. This affects
the dogfood install and likely any consuming project that doesn't have
`type: module`. Adding `type: module` is not an option — it breaks the CLI
(known bug from v0.7.4, see memory: ESM type:module bug).

**Suggestion:** Rename `pib-db.mjs` to `pib-db.mjs` so Node treats it as ESM
regardless of package.json. Update all references (orient phases, debrief
phases, work-scan.md, briefing docs). Alternative: rewrite pib-db.mjs to use
CommonJS `require()`.

**Session context:** Orient's work-scan phase tried to run
`node scripts/pib-db.mjs` and got SyntaxError. Had to fall back to querying
sqlite3 directly throughout the session.
