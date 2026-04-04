# System Status — Claude on Rails

## What's Built

- CLI installer with interactive and flag-based module selection
- 8 modules: session-loop, hooks, work-tracking, planning, compliance, audit, lifecycle, validate
- Template copying with hash-based conflict detection and manifest tracking
- Safe reset via `--reset` (manifest-aware, won't delete customized files)
- Settings merge (hooks into `.claude/settings.json`)
- Optional SQLite work tracker setup
- 20 expert perspectives for audit system
- Conversational onboard, seed, and cor-upgrade skills
- Link/unlink skills for local dev workflow
- `--lean` install option (5 core modules, no DB/compliance/validate)

## What's Active

- Interview UX improvements: one-question-at-a-time flow, earn-the-right-to-ask-specifics
- Lean install option (just shipped)
- Dogfooding: CoR installed on itself via `--lean`
- New perspectives in development: architecture, historian, skills-coverage, system-advocate, usability

## What's Planned

- README update to document `--lean` flag
- Publish v0.2.0 to npm
- Onboard interview testing across different project types
- Perspective seeding from tech signals (`/seed`)
