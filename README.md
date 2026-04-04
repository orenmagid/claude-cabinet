# Claude on Rails

Opinionated process scaffolding for Claude Code projects.

One command gives you a session loop (orient/debrief), work tracking,
structured planning, an audit system with expert perspectives, and
enforcement hooks — all configured through conversational onboarding.

## Quick Start

```bash
npx create-claude-rails
```

That's it. The CLI walks you through module selection, copies skill files,
sets up hooks, and optionally installs a local SQLite work tracker. When
it's done, open Claude Code and run `/onboard` — it interviews you about
your project and generates the context layer that makes everything work.

## What You Get

### Session Loop (always installed)
- **`/orient`** — reads project state, checks health, surfaces what's
  overdue or due today. Every session starts informed.
- **`/debrief`** — marks work done, records lessons, updates state.
  Every session closes the loop.

### Work Tracking (opt-in)
Local SQLite database for actions, projects, and status tracking. Claude
reads and writes it directly — no external service needed. Skip this if
you already use GitHub Issues, Linear, or something else.

### Planning + Execution (opt-in)
- **`/plan`** — structured implementation planning with perspective
  critique before you build.
- **`/execute`** — step-through execution with checkpoints and guardrails.

### Audit System (opt-in)
15 expert perspectives (security, accessibility, data integrity,
performance, etc.) that analyze your codebase and produce structured
findings. Triage UI for reviewing results.

### Compliance Stack (opt-in)
Scoped instructions in `.claude/rules/` that load by file path. An
enforcement pipeline that promotes recurring feedback into deterministic
hooks.

### Lifecycle (opt-in)
- **`/onboard`** — conversational project interview, re-runnable as the
  project matures.
- **`/seed`** — detects new tech in your project, proposes expertise.
- **`/cor-upgrade`** — conversational merge when Claude on Rails updates.

## How It Works

The CLI handles mechanical setup: copying files, merging settings,
installing dependencies. `/onboard` handles intelligent configuration:
it interviews you about your project and generates context files based
on your answers.

**For new projects:** CLI installs everything with defaults. `/onboard`
asks what you're building and sets up the session loop accordingly.

**For existing projects:** CLI detects your project and offers to install
alongside it. `/onboard` scans your tech stack, asks about pain points,
and generates context that makes Claude effective from session one.

Everything is customizable through **phase files** — small markdown files
that override default behavior for any skill. Write content in a phase
file to customize it, write `skip: true` to disable it, or leave it
absent to use the default. No config files, no YAML, no DSL.

## CLI Options

```
npx create-claude-rails                 # Interactive walkthrough
npx create-claude-rails my-project      # Install in ./my-project/
npx create-claude-rails --yes           # Accept all defaults
npx create-claude-rails --yes --no-db   # All defaults, skip database
npx create-claude-rails --dry-run       # Preview without writing files
```

## What Gets Installed

Everything goes into `.claude/` (skills, hooks, rules, memory) or
`scripts/` (database, triage tools). Nothing touches your source code.

```
.claude/
├── skills/          # orient, debrief, plan, execute, audit, etc.
├── hooks/           # git guardrails, telemetry
├── rules/           # enforcement pipeline
├── memory/          # pattern templates
└── settings.json    # hook configuration

scripts/
├── pib-db.js        # work tracking CLI (if installed)
└── ...              # triage tools (if audit installed)

.corrc.json          # installation metadata
```

## Upgrading

```bash
npx create-claude-rails            # re-run to add modules
```

In Claude Code, run `/cor-upgrade` for conversational merge of upstream
changes with your customizations.

## Philosophy

This started as the process layer of [Flow](https://github.com/orenmagid/flow),
a cognitive workspace built on Claude Code over months of daily use. The
patterns that emerged — session loops, perspective-based audits, feedback
enforcement pipelines — turned out to be transferable to any project.

The core idea: Claude Code is powerful, but without process, each session
starts from zero. Orient/debrief creates continuity. Planning with
perspectives catches problems before they ship. The enforcement pipeline
turns recurring mistakes into permanent fixes.

None of this requires you to be a developer. The onboarding interview
meets you where you are, and the system adapts based on what you tell it.

## License

MIT
