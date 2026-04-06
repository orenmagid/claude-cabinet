# System Status — Claude Cabinet

## What's Built

- CLI installer with interactive and flag-based module selection
- 8 modules: session-loop, hooks, work-tracking, planning, compliance, audit, lifecycle, validate
- 3 install modes: Everything, Lean (`--lean`), Custom (interactive per-module)
- Template copying with hash-based conflict detection and manifest tracking
- Existing installs: add-only (no overwrite prompts), updates via `/cc-upgrade`
- Safe reset via `--reset` (manifest-aware, won't delete customized files)
- Settings merge (hooks into `.claude/settings.json`)
- Optional SQLite work tracker setup
- 20 expert cabinet members for audit system
- Split briefing files: identity, architecture, scopes, cabinet, work-tracking, api
- Cabinet member gap detection in debrief (anti-entropy)
- Feedback outbox for non-developers (`~/.claude/cc-feedback-outbox.json`)
- GitHub setup guide for non-developer feedback delivery
- Conversational onboard, seed, and cc-upgrade skills
- Link/unlink skills for local dev workflow
- Publish skill with post-publish dogfood sync
- Extract skill for proposing upstream extraction from consuming projects
- Upstream feedback loop: debrief phase auto-surfaces CC friction from consuming projects
- Write protection: hook blocks edits to manifest-tracked files, prevents downstream drift
- Drift detection: `cc-drift-check.cjs` compares file hashes against manifest
- Dogfooded: installed on itself via `--lean`

## What's Active

- Published at v0.6.8 on npm as `create-claude-cabinet`
- One downstream consumer: Flow (20 upstream + 12 project-specific cabinet members, fully migrated to v0.6.8)
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

### Imminent

- Extract 11 Flow cabinet members into upstream CC templates
  (goal-alignment, gtd, information-design, life-optimization, life-tracker,
   mantine-quality, philosophical-grounding, sync-health, system-tutor,
   ui-experimentalist, vision)
- Source: Flow git history at 209f9f4~1 under perspectives/
- See memory: project_cabinet_extraction.md for full plan

### Later

- Build general-purpose migration into cc-upgrade
- Archive old GitHub repo `orenmagid/claude-on-rails`
- Onboard interview testing across project types
- install.sh manifest builder: add the `build_manifest` completion message
