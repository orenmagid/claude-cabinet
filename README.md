# Claude Cabinet

A cabinet of expert advisors for your Claude Code project. One command
gives Claude a memory, 30 domain experts, a planning process, and the
habit of starting sessions informed and ending them properly.

Built by a guy who'd rather talk to Claude than write code. Most of it
was built by Claude. I just complained until it worked.

## The Idea

Your project gets a cabinet — specialist advisors who each own a domain
and weigh in when their expertise matters:

- **Cabinet members** — 30 domain experts (security, accessibility,
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
No choices to make — you get everything.

Then open [Claude Code](https://claude.ai/code) in the same folder and
say `/onboard`. It'll interview you about your project and set everything
up based on your answers.

**New to this?** See [GETTING-STARTED.md](GETTING-STARTED.md) for a
step-by-step walkthrough. Then [WORKFLOW-GUIDE.md](WORKFLOW-GUIDE.md)
for how to use everything — when to plan, when to audit, what the
cabinet does for you, and how the system grows with your project.

### For developers

If you have Node.js installed and want to choose which modules to
install, or want the lean option (skips work tracking and compliance):

```bash
npx create-claude-cabinet
```

The CLI walks you through module selection, copies skill files,
sets up hooks, and optionally installs a local SQLite work tracker. When
it's done, open Claude Code and run `/onboard`.

## What You Get

### The Session Loop (always installed)

This is the foundation. You run these commands — they don't happen
automatically.

- **`/orient`** — open every session with this. Claude reads project
  state, checks health, surfaces what needs attention, and briefs you
  so you never start blind. Think of it as the morning briefing before
  the cabinet gets to work.
- **`/debrief`** — close every session with this. Claude marks work
  done, records lessons, updates state, and prepares the briefing for
  next time. Without debrief, the next orient starts with stale
  information. The loop is what gives Claude memory across sessions.

**The habit matters.** Orient and debrief take 30 seconds each. Skip
them and sessions start from zero — Claude forgets what happened,
repeats mistakes, and you spend the first 10 minutes re-explaining
context. Keep the loop and each session picks up where the last one
left off.

### The Cabinet (included in lean)

30 expert cabinet members who each own a domain and stay in their lane.
**Speed-freak** watches performance. **Boundary-man** catches edge cases.
**Record-keeper** flags when docs drift from code. **Workflow-cop**
evaluates whether your process actually works. Each member has a
portfolio, produces structured findings, and knows when to speak up
and when to stay quiet.

You convene the cabinet with **`/audit`** — run it occasionally (every
few sessions, or before a release) to get a full review from every
relevant member. You don't need to audit every session. The cabinet
waits until called.

Members are organized into **committees** — groups by concern, so you
can convene just the experts you need. Security review? Convene the
security committee. Performance concerns? Just the speed committee.

### Planning + Execution (included in lean)

Don't just start building — brief the cabinet first.

- **`/plan`** — describe what you want to build. Claude drafts a plan,
  then the relevant cabinet members critique it before a single line is
  written. The security member notices the missing auth check. The
  data integrity member catches the NULL handling gap. You approve the
  plan, and it carries enough detail for any future session to execute
  without re-exploring.
- **`/execute`** — pick up an approved plan and build it step by step.
  Cabinet members watch at each checkpoint. The plan tells Claude what
  to do; execute makes sure it gets done right.

### Work Tracking (full install)

Local SQLite database for actions, projects, and status tracking. Claude
reads and writes it directly — no external service needed. Skip this if
you already use GitHub Issues, Linear, or something else.

### Compliance Stack (full install)

Scoped instructions in `.claude/rules/` that load by file path. An
enforcement pipeline that promotes recurring feedback into deterministic
hooks — things that keep going wrong become things that can't go wrong.

### Lifecycle (included in lean)

- **`/onboard`** — the cabinet's first briefing. Claude interviews you
  about your project and prepares everything the members need to do
  their jobs. Re-run it as the project matures — the interview adapts.
- **`/seed`** — recruit new members. Claude detects new tech in your
  project and proposes expert members to cover it. Your cabinet grows
  with your project.
- **`/cc-upgrade`** — when Claude Cabinet publishes updates, this skill
  runs the installer for the mechanical parts and walks you through
  what changed conversationally. Intelligence is the merge strategy.

## Your Workflow

The day-to-day rhythm:

1. **Start a session** → `/orient` (get briefed)
2. **Do your work** → talk to Claude, use `/plan` for anything non-trivial
3. **Build it** → `/execute` to implement approved plans with cabinet oversight
4. **Check quality** → `/audit` occasionally for a full cabinet review
5. **Close the session** → `/debrief` (close the loop)

Steps 1 and 5 are the minimum. Everything in between is yours to use as
needed. The more you use, the more the cabinet learns about your project.

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
│   └── cabinet-*/   # 30 cabinet member definitions
├── cabinet/         # committees, lifecycle, composition patterns
├── briefing/        # project briefing templates
├── hooks/           # git guardrails, telemetry
├── rules/           # enforcement pipeline
├── memory/          # pattern templates
└── settings.json    # hook configuration

scripts/
├── pib-db.mjs        # work tracking CLI (if installed)
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
