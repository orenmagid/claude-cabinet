# Paths — Claude Cabinet

Cabinet members reference these sections by name to know where to look.

## App Source
`lib/*.js` — all CLI logic (6 files)
`bin/create-claude-cabinet.js` — entry point

## Templates
`templates/skills/` — all skill definitions and phase files
`templates/hooks/` — hook scripts
`templates/scripts/` — database and triage tooling
`templates/rules/` — compliance templates
`templates/memory/` — pattern templates

## Data Store
SQLite at `./pib.db` (via `scripts/pib-db.js`)
Schema: `scripts/pib-db-schema.sql`

## Audit Infrastructure
`scripts/finding-schema.json` — finding schema
`scripts/merge-findings.js` — finding merge logic
`scripts/triage-server.mjs` — triage web UI server
`scripts/triage-ui.html` — triage web UI
`scripts/load-triage-history.js` — triage history loader
`scripts/resolve-committees.cjs` — committee merge at runtime

## Documentation Files
`README.md` — public-facing install instructions, feature list, philosophy.
Must stay in sync with: current version number, module count, cabinet member
count, install methods (shell + npm), CLI flags, and what actually ships.

`WORKFLOW-GUIDE.md` — comprehensive user journey guide. When to plan vs. just
build, when to audit, how to use investigate, how the cabinet works in practice,
how the system grows. Targeted at users who have installed and onboarded.

`GETTING-STARTED.md` — step-by-step install guide for first-time users.

`system-status.md` — what's built and what's active.
Must reflect reality after every session (debrief updates it).

`CLAUDE.md` — project conventions for Claude. Must match actual codebase
structure and current workflow.

`templates/skills/*/SKILL.md` — skill definitions shipped to consumers.
Must accurately describe their own workflow steps, phase file protocol,
frontmatter fields, and related file paths.

`templates/skills/*/phases/*.md` — phase files shipped to consumers.
Instruction-bearing phases must be accurate. Example/template phases
(with commented-out content) must show realistic patterns.

`templates/briefing/_briefing-template.md` — the template consuming projects
use to build their `_briefing.md`. Must list all `§` section names that
generic cabinet member SKILL.md files reference.

`install.sh` — shell installer. Must download the current version,
install the same modules as `--lean`, and produce a working setup.

`package.json` — version must match the latest published tag.

### Documentation Staleness Signals
The most common documentation failures in this project:
- README claims (cabinet member count, module count, features) drifting
  from what actually ships in templates/
- system-status.md not updated after a session's work
- Cabinet member SKILL.md files referencing `_briefing.md §` sections that
  the `_briefing-template.md` doesn't define
- install.sh hardcoded version falling behind the latest npm publish
- CLAUDE.md listing files or conventions that no longer exist

## System Status
`system-status.md` — what's built and what's active (root)

## Friction Captures
`feedback/` — from linked consuming projects (filed during debrief)
GitHub issues labeled `field-feedback` — from unlinked consuming projects
