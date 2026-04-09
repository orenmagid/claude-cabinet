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
- 27 expert cabinet members for audit system (all professionalized with Investigation Protocol pattern)
- Cabinet member template: `_cabinet-member-template.md` defines required structure for /seed
- Tiered Investigation Protocol: Stage 1 (Instrument — automated tools with fallbacks) → Stage 2 (Analyze — manual reasoning informed by Stage 1)
- `tools:` frontmatter on all 27 members declares tool dependencies (informational, not hard deps)
- Historically Problematic Patterns: two-file overlay — upstream SKILL.md (CC-owned) + `patterns-project.md` (project-owned)
- Pattern lifecycle: audit finding → recurs → debrief writes patterns-project.md → universal patterns promoted upstream → cc-upgrade deduplicates
- Audit pattern capture: debrief phase detects recurring findings and writes to patterns-project.md
- Pattern promotion: debrief upstream-feedback phase scans patterns-project.md for universal candidates
- cc-upgrade deduplication: compares upstream HPP against patterns-project.md, removes promoted duplicates
- Validate check: shell validator verifies cabinet member structure (tools, Investigation Protocol, Portfolio Boundaries, Calibration Examples, HPP)
- Skill index includes `tools` field from cabinet member frontmatter
- Split briefing files: identity, architecture, jurisdictions, cabinet, work-tracking, api
- Cabinet member gap detection in debrief (anti-entropy)
- Feedback outbox for non-developers (`~/.claude/cc-feedback-outbox.json`)
- GitHub setup guide for non-developer feedback delivery
- Conversational onboard, seed, and cc-upgrade skills
- cc-link/cc-unlink skills for local dev workflow
- Publish skill (CC-source-repo only, not shipped to consumers)
- Record-keeper handles doc freshness during debrief cabinet consultations (Step 3)
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
- Skill index (`_index.json`): generated at install time, caches metadata for all 49 skills
- `/cabinet` skill: front door to browse and consult expert cabinet members
- `/work-tracker` skill: opens work tracking UI interactively
- Standing mandates in frontmatter: 23 cabinet members declare which contexts they activate in
- Scoped directives: 12 cabinet members declare per-context focused tasks (plan, execute, orient, debrief, investigate, seed)
- Cabinet consultations wired into orient, debrief, investigate, and seed skeletons
- Block scalar YAML parsing: parseFrontmatter handles `description: >` and `description: |` correctly
- WORKFLOW-GUIDE.md: comprehensive user journey guide (when to plan, audit, investigate; how cabinet works)
- Project-level directive overlay: `directives-project.yaml` in `.claude/cabinet/` extends upstream members with project-specific mandates without modifying upstream files
- stop-hook.md removed: prompt-type Stop hook deleted (caused infinite loop via session_stop → session_stop). hooks count is now 4.
- Memory adapter ONNX fix: `cabinet-memory-adapter.py` uses `os._exit(0)` instead of `sys.exit(0)` to avoid SIGSEGV from ONNX cleanup on exit
- Plugin format exploration: project `prj:plugin-format` filed in pib-db with 4 actions; exploring whether skills/cabinet members can be distributed as installable plugins
- ESM rename: `pib-db.js` → `pib-db.mjs` across 37+ files (fixes ESM import issues without type:module in package.json)
- Omega memory guard: `omega-memory-guard.sh` PreToolUse hook blocks flat markdown memory writes when omega is active
- Orient briefing strengthened: default orient now requires 5 sections (State of the World, What's Active, Decision Queue, Health, Suggested Focus)
- better-sqlite3 error handling: distinguishes version mismatch from missing module
- settings-merge.js: MEMORY_HOOKS constant and `includeMemory` param for memory module hook injection
- db-setup.js: no longer injects `type:module` into package.json (removed to prevent CLI breakage)

## What's Active

- Published at v0.13.0 on npm as `create-claude-cabinet`
- Two downstream consumers: Flow (v0.12.1), multiShopper (v0.5.4, experiment)
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
`node scripts/pib-db.mjs list-projects` and `node scripts/pib-db.mjs list-actions`.
