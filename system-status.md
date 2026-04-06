# System Status — Claude on Rails (renaming to Claude Cabinet)

## What's Built

- CLI installer with interactive and flag-based module selection
- 8 modules: session-loop, hooks, work-tracking, planning, compliance, audit, lifecycle, validate
- 3 install modes: Everything, Lean (`--lean`), Custom (interactive per-module)
- Template copying with hash-based conflict detection and manifest tracking
- Existing installs: add-only (no overwrite prompts), updates via `/cor-upgrade`
- Safe reset via `--reset` (manifest-aware, won't delete customized files)
- Settings merge (hooks into `.claude/settings.json`)
- Optional SQLite work tracker setup
- 20 expert perspectives for audit system (renaming to "cabinet members")
- Split context files: identity, architecture, scopes, cabinet, work-tracking, api (renaming to "briefings")
- Perspective gap detection in debrief (anti-entropy)
- Feedback outbox for non-developers (`~/.claude/cor-feedback-outbox.json`)
- GitHub setup guide for non-developer feedback delivery
- Conversational onboard, seed, and cor-upgrade skills
- Link/unlink skills for local dev workflow
- Publish skill with post-publish dogfood sync
- Extract skill for proposing upstream extraction from consuming projects
- Upstream feedback loop: debrief phase auto-surfaces CoR friction from consuming projects
- Write protection: hook blocks edits to manifest-tracked files, prevents downstream drift
- Drift detection: `cor-drift-check.cjs` compares file hashes against manifest
- Dogfooded: installed on itself via `--lean`

## What's Active

- Published at v0.5.8 on npm as `create-claude-rails`
- One downstream consumer: Flow (32 perspectives, v0.5.1 installed)
- Upstream feedback loop active
- Write protection + drift detection active

## What's Planned

### Imminent: Full Cabinet Restructure (PLAN-cabinet-restructure.md)

- Rename project: Claude on Rails → **Claude Cabinet**
- Rename package: `create-claude-rails` → **`create-claude-cabinet`**
- Rename terminology: perspectives→cabinet members, groups→committees,
  context→briefings, lanes→portfolios, activation signals→convening criteria
- Rename 7 members: boundary-man, process-therapist, small-screen,
  roster-check, record-keeper, workflow-cop, speed-freak
- Restructure directories: members stay in `skills/cabinet-*/`,
  infrastructure to `cabinet/`, briefings to `briefing/`
- Version bump to 0.6.0
- Flow migration after upstream lands

### After Restructure

- Build 7 new cabinet members: goal-alignment, information-design,
  user-advocate, ui-experimentalist, vision, framework-quality, gtd
- Build pre-built variant: mantine-quality (PAIR with framework-quality)
- Build general-purpose migration into cor-upgrade
- Rename GitHub repo
- Set up npm redirect from old package name
- Onboard interview testing across project types
