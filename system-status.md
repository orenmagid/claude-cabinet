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

- Published at v0.6.2 on npm as `create-claude-cabinet`
- One downstream consumer: Flow (32 cabinet members, v0.5.1 installed — migration ready)
- cc-health has v0.5→v0.6 content audit (7B) and structural integrity checks (7C)
- cc-upgrade has legacy migration step (2.5) and intelligent terminology pass
- Upstream feedback loop active
- Write protection + drift detection active

## What's Planned

### Imminent: Flow Migration

- Migrate Flow from old `perspectives/` structure to new `cabinet-*/` structure
- Migration tooling built: cc-upgrade Step 2.5 handles the full transition
- Process: new branch → `npx create-claude-cabinet --yes` → `/cc-upgrade` → `/audit cc-health`
- See PLAN-cabinet-restructure.md Part 5 for full migration plan

### Before Migration

- ✅ Publish to npm as `create-claude-cabinet` (v0.6.0)
- ✅ Deprecate old `create-claude-rails` package (all 21 versions)
- ✅ Create new GitHub repo `orenmagid/claude-cabinet`, push, update URLs
- ✅ Rename local directory `~/claude-on-rails` → `~/claude-cabinet`
- ✅ Copy memory files to new Claude Code project path
- ✅ Re-run lean install to dogfood published package (v0.6.0)
- ✅ Fix `~/.claude/cc-registry.json` (updated path and version)
- ✅ Migrate project briefing from `perspectives/_context.md` to `briefing/_briefing.md`
- ✅ Remove stale `perspectives/` directory
- ✅ Update orient `context.md` phase to reference new briefing path
- See PLAN-cabinet-restructure.md Part 5F for ordered steps

### After Migration

- Build 7 new cabinet members: goal-alignment, information-design,
  user-advocate, ui-experimentalist, vision, framework-quality, gtd
- Build pre-built variant: mantine-quality (PAIR with framework-quality)
- Build general-purpose migration into cc-upgrade
- Archive old GitHub repo `orenmagid/claude-on-rails`
- Onboard interview testing across project types
