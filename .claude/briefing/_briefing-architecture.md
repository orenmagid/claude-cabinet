# Architecture — Claude Cabinet

## System Structure

Single-layer Node CLI with no build step:

- `bin/create-claude-cabinet.js` — entry point
- `lib/cli.js` — argument parsing, module selection, orchestration
- `lib/copy.js` — template file copying with conflict detection
- `lib/metadata.js` — `.ccrc.json` read/write (manifest, module state)
- `lib/settings-merge.js` — merges hook config into `.claude/settings.json`
- `lib/db-setup.js` — optional SQLite work tracker setup
- `lib/reset.js` — manifest-safe file removal
- `install.sh` — shell installer (no Node.js required, downloads from npm registry)
- `templates/` — all skill definitions, phase files, hooks, scripts, cabinet members

No data store. No server. One runtime dependency (`prompts` for interactive CLI).
Two install paths: `npx create-claude-cabinet` (Node.js) or `curl | bash` (shell).
Published to npm as `create-claude-cabinet`.

## Codebase Layout

```
lib/
  cli.js            — main orchestration, module definitions, arg parsing
  copy.js           — file copying with hash-based conflict detection
  metadata.js       — .ccrc.json CRUD
  settings-merge.js — .claude/settings.json hook merging
  db-setup.js       — SQLite setup (optional module)
  reset.js          — manifest-safe file removal

templates/
  skills/           — orient, debrief, plan, execute, audit, onboard, etc.
  cabinet/          — committees, lifecycle, composition patterns, eval protocol
  briefing/         — briefing templates for consuming projects
  hooks/            — git-guardrails, upstream-guard, telemetry scripts
  scripts/          — pib-db.mjs, triage tools, cc-drift-check.cjs
  rules/            — enforcement-pipeline.md
  memory/           — pattern templates

bin/
  create-claude-cabinet.js — npm bin entry point

install.sh          — shell installer (no Node.js required)
```

## Technology Stack

- Node.js (no build step, no transpilation)
- One runtime dependency: `prompts` (interactive CLI)
- SQLite via `better-sqlite3` for pib-db work tracking
- Published to npm as `create-claude-cabinet`
