# Claude Cabinet — Project Instructions

Node CLI package (`create-claude-cabinet`) that scaffolds process infrastructure
for Claude Code projects. Small codebase: 12 files in `lib/`, templates in
`templates/`. Two dependencies (`prompts`, `better-sqlite3`). No build step.

## Key Files

- `lib/cli.js` — main orchestration, module definitions, all CLI logic
- `lib/copy.js` — template copying with conflict detection
- `lib/settings-merge.js` — merges CC hooks into `.claude/settings.json`;
  also heals `~/.claude/settings.json` by stripping CC hook entries with
  project-relative paths (runs unconditionally on every install)
- `lib/migrate-from-omega.js` — one-time omega → built-in memory migration
  engine (`--migrate-memory`): exports omega memories to Claude Code's
  built-in memory layout (fresh-write or additive `omega-migrated/` merge
  when native memory already exists), backs up first, then tears down
  omega hooks/MCP. Never overwrites native files.
- `lib/migrate-memory-cmd.js` — CLI command wrapper for the migration
  (`--migrate-memory`, `--dry-run`, `--unmigrate-memory` rollback)
- `lib/verify-setup.js` — cabinet-verify runtime installer (creates
  `~/.claude-cabinet/verify/<version>/dist/cabinet-verify-<version>.tgz`
  via `npm pack`; writes `~/.claude-cabinet/verify/current/VERSION` pointer)
- `lib/site-audit-setup.js` — site-audit runtime installer (mirrors
  verify-setup; packs `templates/site-audit-runtime/` to
  `~/.claude-cabinet/site-audit/<version>/`)
- `templates/skills/` — skill definitions (SKILL.md) and phase files
- `templates/skills/onboard/` — conversational onboarding skill
- `templates/skills/cabinet-*/` — 31 expert cabinet member definitions
- `templates/skills/verify/` — walkthrough-verification skeleton skill
  (Cucumber + Playwright; opt-in via the `verify` module)
- `templates/verify-runtime/` — `cabinet-verify` npm package source
  (lifted from de[sic]ify's e2e/support/; packed into the install dir
  by `lib/verify-setup.js`)
- `templates/site-audit-runtime/` — `@claude-cabinet/site-audit` npm
  package source (15-check engine with per-check modules in `src/checks/`;
  packed by `lib/site-audit-setup.js`)
- `templates/skills/cc-site-audit/` — /cc-site-audit skill definition +
  install.sh + phase seams
- `templates/cabinet/` — cabinet infrastructure (committees, lifecycle, etc.)
- `templates/briefing/` — project briefing templates
- `.ccrc.json` — installation metadata and manifest (generated, gitignored)

## Modules

- **session-loop** (mandatory): orient + debrief skeleton skills
- **hooks**, **work-tracking**, **planning**, **compliance**, **memory**,
  **audit**, **lifecycle**, **validate** (default-installed)
- **verify** (opt-in, off by default): Cucumber + Playwright walkthrough
  harness. Runtime at `~/.claude-cabinet/verify/<version>/`. /verify
  skeleton skill + opt-in /plan, /execute, /debrief integration phases.
- **site-audit** (opt-in, off by default): 15-check deployed-site quality
  audit. Runtime at `~/.claude-cabinet/site-audit/<version>/`. /cc-site-audit
  skill + comparison mode + standalone HTML report.

Eleven modules total. The **memory** module (v0.27.2+) provides a curated
write/validate layer over Claude Code's built-in file memory: `/cc-remember`
writes indexed memories, `/memory` browses them, `validate-memory.mjs`
guards MEMORY.md integrity, and `memory-index-guard.sh` (PostToolUse hook)
flags unindexed writes. This replaced the retired omega-memory engine
(Python venv) from the v0.27 wind-down. The CLI still ships one-time
migration tooling (`--migrate-memory`) for projects upgrading off omega
— see `MIGRATION-0.27.md`.

## Conventions

- Skills use the skeleton/phase pattern: SKILL.md defines orchestration,
  phase files customize behavior. Phase files are absent (use default),
  contain content (override), or contain `skip: true` (disable).
- Phase files split into two kinds: **instruction phases** (always ship
  with CC — e.g., `audit-pattern-capture.md`, `methodology-capture.md`,
  `upstream-feedback.md` — explicitly listed in the module manifest in
  `lib/cli.js` so they override the default skip-phases rule) and
  **customization phases** (skipped by default, opt-in per project).
  Instruction phases must not be omitted when editing module manifests.
- Templates in `templates/` are the upstream source of truth. Installed
  copies in `.claude/skills/` are downstream (gitignored for this project).
- Module definitions live in the `MODULES` object in `lib/cli.js`.

## Claude Should Always

- Test CLI changes with `--dry-run` before running for real
- Check that `node -c lib/cli.js` passes after editing CLI code
- Preserve the skeleton/phase separation — never hardcode project-specific
  logic into SKILL.md files
- Write interview questions one at a time, never batched

## Dogfooding

When installing CC on itself (the source repo), always use:
```bash
node bin/create-claude-cabinet.js --yes
```
Never use `npx create-claude-cabinet` from inside the source directory —
npx resolves the local package.json instead of fetching from npm,
which can install stale cached versions.

## Claude Should Never

- Add dependencies without discussing it first — the minimal-dependency
  footprint is intentional
- Modify installed `.claude/skills/` files directly — edit the templates
  in `templates/` instead (installed copies are downstream)
- Generate phase files with placeholder content — absent is better than
  generic
