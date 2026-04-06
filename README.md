# Claude Cabinet

A cabinet of expert advisors for your Claude Code project. One command
gives Claude a memory, 20 domain experts, a planning process, and the
habit of starting sessions informed and ending them properly.

Built by a guy who'd rather talk to Claude than write code. Most of it
was built by Claude. I just complained until it worked.

## The Idea

Your project gets a cabinet — specialist advisors who each own a domain
and weigh in when their expertise matters:

- **Cabinet members** — 20 domain experts (security, accessibility,
  architecture, QA, etc.) who review your project and surface what
  you'd miss alone
- **Briefings** — project context members read before weighing in
- **Committees** — members grouped by concern so you convene the right
  experts for the right question
- **The session loop** — `/orient` briefs you at the start, `/debrief`
  closes the loop for next time

## Install

Open a terminal, `cd` into your project folder, and run:

```bash
curl -fsSL https://raw.githubusercontent.com/orenmagid/claude-cabinet/main/install.sh | bash
```

That's it. If you don't have git or Node.js, it installs them.
No choices to make — it sets up everything.

Then open [Claude Code](https://claude.ai/code) in the same folder and
say `/onboard`. It'll interview you about your project and set everything
up based on your answers.

**New to this?** See [GETTING-STARTED.md](GETTING-STARTED.md) for a
step-by-step walkthrough.

### For developers

If you have Node.js installed and want interactive module selection,
database setup, or the full install:

```bash
npx create-claude-cabinet
```

The CLI walks you through module selection, copies skill files,
sets up hooks, and optionally installs a local SQLite work tracker. When
it's done, open Claude Code and run `/onboard`.

## What You Get

### The Session Loop (always installed)
- **`/orient`** — session briefing. Reads project state, checks health,
  surfaces what needs attention. Every session starts informed.
- **`/debrief`** — session close. Marks work done, records lessons,
  updates state. Every session closes the loop so the next one starts
  clean.

### The Cabinet (opt-in)
20 expert cabinet members who audit your project from their domain:
**speed-freak** watches performance, **boundary-man** catches edge cases,
**record-keeper** flags when docs drift from code, **workflow-cop**
evaluates whether your process actually works. Each member has a
portfolio, stays in it, and produces structured findings you can
triage. Convene the whole cabinet or just the committee you need.

### Planning + Execution (opt-in)
- **`/plan`** — structured planning with cabinet critique. Before you
  build, the relevant members weigh in on your approach.
- **`/execute`** — step-through execution with checkpoints. Cabinet
  members watch at each stage.

### Work Tracking (opt-in)
Local SQLite database for actions, projects, and status tracking. Claude
reads and writes it directly — no external service needed. Skip this if
you already use GitHub Issues, Linear, or something else.

### Compliance Stack (opt-in)
Scoped instructions in `.claude/rules/` that load by file path. An
enforcement pipeline that promotes recurring feedback into deterministic
hooks — things that keep going wrong become things that can't go wrong.

### Lifecycle (opt-in)
- **`/onboard`** — conversational project interview, re-runnable as the
  project matures.
- **`/seed`** — detects new tech in your project, recruits cabinet
  members with the right expertise.
- **`/cc-upgrade`** — conversational merge when Claude Cabinet updates.

## How It Works

The CLI handles mechanical setup: copying files, merging settings,
installing dependencies. `/onboard` handles intelligent configuration:
it interviews you about your project and generates the briefings your
cabinet needs — who you are, what you're building, what the architecture
looks like, where things live.

Everything is customizable through **phase files** — small markdown files
that override default behavior for any skill. Write content in a phase
file to customize it, write `skip: true` to disable it, or leave it
absent to use the default. No config files, no YAML, no DSL.

## CLI Options

```
npx create-claude-cabinet                 # Interactive walkthrough
npx create-claude-cabinet my-project      # Install in ./my-project/
npx create-claude-cabinet --yes           # Accept all defaults
npx create-claude-cabinet --yes --no-db   # All defaults, skip database
npx create-claude-cabinet --dry-run       # Preview without writing files
```

## What Gets Installed

Everything goes into `.claude/` or `scripts/`. Nothing touches your
source code.

```
.claude/
├── skills/          # orient, debrief, plan, execute, audit, etc.
│   └── cabinet-*/   # 20 cabinet member definitions
├── cabinet/         # committees, lifecycle, composition patterns
├── briefing/        # project briefing templates
├── hooks/           # git guardrails, telemetry
├── rules/           # enforcement pipeline
├── memory/          # pattern templates
└── settings.json    # hook configuration

scripts/
├── pib-db.js        # work tracking CLI (if installed)
└── ...              # triage tools (if audit installed)

.ccrc.json           # installation metadata
```

## Upgrading

Re-run the installer to pick up new versions:

```bash
# Shell installer (re-downloads latest)
curl -fsSL https://raw.githubusercontent.com/orenmagid/claude-cabinet/main/install.sh | bash

# npm installer (if using Node.js)
npx create-claude-cabinet
```

In Claude Code, run `/cc-upgrade` for conversational merge of upstream
changes with your customizations.

## Works Across Projects

Claude Cabinet isn't just for one project — it manages how you work
with Claude everywhere.

- **Your identity** (`~/.claude/CLAUDE.md`) — set up once, carries to
  every project. Claude always knows who you are and what you do.
- **Project registry** (`~/.claude/cc-registry.json`) — tracks all
  your projects. `/onboard` asks how they relate; `/orient` flags
  when work in one might affect another.
- **Debrief maintenance** — if you mention something new about yourself
  or your project evolves, `/debrief` proposes updating your profile
  and registry so the next session starts current.

Install in each project folder. They're independent but aware of each
other.

## Philosophy

This started as the process layer of [Flow](https://github.com/orenmagid/flow),
a cognitive workspace built on Claude Code over months of daily use. The
patterns that emerged — the session loop, cabinet-style audits, feedback
enforcement — turned out to be transferable to any project.

The core idea: Claude Code is powerful, but without process, each session
starts from zero. The session loop creates continuity. The cabinet catches
problems before they ship. The enforcement pipeline turns recurring
mistakes into permanent fixes.

None of this requires you to be a developer. I'm barely one myself. The
onboarding interview meets you where you are, and the system adapts
based on what you tell it.

This is very much a work in progress. Things will break. The session
loop is solid; everything else is still finding its shape. If you try it
and something's weird, that's not you — it's probably me. Or Claude.
We're figuring it out together.

## License

MIT
