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
- 31 expert cabinet members for audit system (all professionalized with Investigation Protocol pattern)
- Cabinet member template: `_cabinet-member-template.md` defines required structure for /seed
- Tiered Investigation Protocol: Stage 1 (Instrument — automated tools with fallbacks) → Stage 2 (Analyze — manual reasoning informed by Stage 1)
- `tools:` frontmatter on all 31 members declares tool dependencies (informational, not hard deps)
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
- Skill index (`_index.json`): generated at install time, caches metadata for all 50 skills
- Plugin skill indexing: `generateSkillIndex()` reads `.claude-plugin/plugin.json` and indexes plugin skills with `type: "plugin"` and `source` field
- `/cc-feedback` skill: file upstream feedback mid-session without waiting for debrief (lifecycle module)
- Menu skill: third "Plugins" group for plugin-type skills, grouped by source
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
- Template source guard: `template-source-guard.sh` PreToolUse hook (Edit|Write) blocks edits to installed copies when a template upstream exists; CC-source-repo-only (prevents template/source divergence, root cause of v0.19.2)
- Orient briefing strengthened: default orient now requires 5 sections (State of the World, What's Active, Decision Queue, Health, Suggested Focus)
- better-sqlite3 error handling: distinguishes version mismatch from missing module
- settings-merge.js: MEMORY_HOOKS constant and `includeMemory` param for memory module hook injection
- db-setup.js: no longer injects `type:module` into package.json (removed to prevent CLI breakage)
- Work-tracker: auto-detects a free port at startup (no hardcoded port conflicts)
- Work-tracker UI: displays project name in header and browser tab (reads from package.json)
- Work-tracker: `/api/meta` endpoint exposes project name and other metadata to the UI
- Debrief close-work phase: resolves field feedback from the feedback queue (queue-not-ledger pattern)
- cc-publish Step 6: automatically updates all registered local consumers from cc-registry after publish
- $ARGUMENTS support: 7 skills (audit, plan, cabinet, investigate, execute, orient, debrief) accept arguments via `argument-hint` frontmatter
- `resolve-arguments.cjs`: resolves raw argument strings against cabinet member names and committees.yaml
- settings-merge.js: dedup logic uses `h.command || h.prompt` key (handles both hook types if needed)
- pib-db shared library: `pib-db-lib.mjs` exports all db operations, consumed by both CLI and MCP server
- pib-db MCP server: JSON-RPC 2.0 over stdio, 10 tools (pib_create_action enforces Surface Area format)
- MCP config merge: installer adds pib-db server to `.mcp.json` when work-tracking module is selected
- `templates/mcp/pib-db.json`: MCP server configuration template
- `templates/cabinet/pib-db-access.md`: protocol doc for MCP-first, CLI-fallback db access
- Two new cabinet members: `narrative-architect` (story structure analyst) and `interactive-storyteller` (interactive medium craft analyst)
- Interactive timeline demo: `docs/demo-timeline.html` — 967-line standalone HTML showcase of CC's development history

## What's Active

- Published at v0.19.2 on npm as `create-claude-cabinet`
- Four downstream consumers: Flow, article-rewriter, theater-cheater, CC dogfood
- MCP-first protocol: all pib-db-touching skills prefer pib_* MCP tools with CLI fallback
- anthropic-insider has verification mandate (verify platform features before recommending)
- organized-mind scoped to human cognition (cognitive load ≠ AI load)
- cc-feedback/debrief dogfood routing fixed (package.json name check)
- plan skill enforces Surface Area format in step 6b
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
