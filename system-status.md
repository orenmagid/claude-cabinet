# System Status — Claude Cabinet

## What's Built

- CLI installer with interactive and flag-based module selection
- 9 modules: session-loop, hooks, work-tracking, planning, compliance, audit, lifecycle, validate, memory
- 3 install modes: Everything, Lean (`--lean`), Custom (interactive per-module)
- Template copying with hash-based conflict detection and manifest tracking
- Existing installs: add-only (no overwrite prompts), updates via `/cc-upgrade`
- Safe reset via `--reset` (manifest-aware, won't delete customized files)
- Settings merge (hooks into `.claude/settings.json`)
- Optional SQLite work tracker setup
- 27 expert cabinet members for audit system
- Split briefing files: identity, architecture, jurisdictions, cabinet, work-tracking, api
- Cabinet member gap detection in debrief (anti-entropy)
- Feedback outbox for non-developers (`~/.claude/cc-feedback-outbox.json`)
- GitHub setup guide for non-developer feedback delivery
- Conversational onboard, seed, and cc-upgrade skills
- Link/unlink skills for local dev workflow
- Publish skill (CC-source-repo only, not shipped to consumers)
- Debrief skeleton checks briefing freshness by default (Step 4)
- cc-health Check 6 has concrete cross-references (ccrc vs briefing, pib-db vs claims)
- Extract skill for proposing upstream extraction from consuming projects
- Upstream feedback loop: debrief phase auto-surfaces CC friction from consuming projects
- Write protection: hook blocks edits to manifest-tracked files, prevents downstream drift
- Drift detection: `cc-drift-check.cjs` compares file hashes against manifest
- Semantic memory module: omega-memory backend, project-scoped tiered retrieval, /memory skill
- Python venv setup: auto-discovers Python 3.11+, creates venv at ~/.claude-cabinet/omega-venv/
- Memory: omega native hooks (5 hooks in global settings), slimmed adapter (4 commands)
- Memory maintenance: consolidate (every session), compact + discover_connections + backup (weekly)
- Knowledge graph: traverse, link, contradiction detection, auto-relate on store
- Historian memory health measurement: growth, connectivity, contradictions, retrieval quality
- Dogfooded: installed on itself (full install, all 9 modules)
- Split briefing files for dogfood install: identity, architecture, jurisdictions, cabinet, work-tracking

## What's Active

- Published at v0.10.0 on npm as `create-claude-cabinet`
- One downstream consumer: Flow (v0.8.5, 27 upstream + 6 project-specific cabinet members)
- install.sh fetches latest version dynamically from npm (no more hardcoded version)
- install.sh manifest builder only tracks upstream template files (not all project files)
- cc-health has v0.5→v0.6 content audit (7B) and structural integrity checks (7C)
- cc-upgrade has legacy migration step (2.5), intelligent terminology pass, and `upgrade/` cleanup
- Upstream feedback loop active
- Write protection + drift detection active
- Legacy manifest detection: installer now reads `.corrc.json` for v0.5.x upgrades
- Data schema: `cabinet-member`/`cabinet_member` across all scripts and templates
- Two-file committee system: upstream `committees.yaml` + project `committees-project.yaml`
- `resolve-committees.cjs` script for deterministic merge at runtime

## What's Planned

Planned work is tracked in pib-db (`./pib.db`). Query with
`node scripts/pib-db.js list-projects` and `node scripts/pib-db.js list-actions`.
