# Getting Started with Claude Cabinet

This guide assumes you have Claude Code installed (the desktop app or CLI)
and a terminal. That's it. No programming experience needed.

## What is this?

Claude Cabinet gives your project a cabinet — a team of expert advisors
and a structured way to get things done across multiple sessions. Without
it, every conversation with Claude starts from scratch. With it, Claude
starts each session already briefed on where things stand, what needs
attention, and what happened last time.

It works for any project — code, writing, research, business planning.
If you're using Claude Code to build or manage something over multiple
sessions, this helps.

## How it works

- **`/orient`** — start each session briefed. Claude reads project state,
  checks what's due, and tells you what needs attention.
- **The cabinet** — 27 domain experts (security, performance,
  accessibility, architecture, etc.) who review your project and flag
  what you'd miss alone. They show up during audits and planning.
- **`/debrief`** — end each session by closing the loop. Claude records
  what happened, closes finished work, and prepares the briefing for
  next time.

You're the decision-maker. The cabinet advises. Claude does the legwork.

## Do I need this?

The simplest test: **are you coming back tomorrow?**

If you're working on something that will take more than one sitting —
an app, a website, a research project, a business you're building —
then every time you start a new conversation with Claude, you lose
context. You end up re-explaining what you're doing, what you decided
last time, what's left. The bigger the project gets, the more time
you spend catching Claude up instead of making progress.

Claude Cabinet fixes that. You sit down, say `/orient`, and Claude
already knows where things stand.

If you're just asking Claude a quick question and moving on — "what's
the capital of France," "help me write this email" — you don't need
any of this. Claude is great at one-off conversations out of the box.
This is for the stuff that lives longer than a single chat.

## Install

### Step 1: Create a project folder

If you don't already have one, create a folder for your project.
Open Terminal and run:

```bash
mkdir ~/my-project
cd ~/my-project
```

Replace `my-project` with whatever you want to call it.

### Step 2: Run the installer

```bash
curl -fsSL https://raw.githubusercontent.com/orenmagid/claude-cabinet/main/install.sh | bash
```

The installer handles everything:
- If you don't have git or Node.js, it installs them (may ask for your
  Mac password — that's normal)
- It sets up a git repository in your folder if there isn't one
- It installs the full cabinet: session loop, 27 expert members,
  planning tools, hooks, and triage system
- It creates a task database for tracking work between sessions

The first time you run it, it'll ask two extra questions: **your name**
and **what you do**. This creates a profile that Claude sees in every
project — so you never have to re-explain who you are.

### Step 3: Open Claude Code

Open Claude Code (the desktop app or CLI) in your project folder.

**Desktop app:** Open Claude Code, then use File > Open Folder (or
drag your folder onto the app window).

**CLI:** In terminal, make sure you're in your project folder and run
`claude`.

### Step 4: Run onboarding

In Claude Code, type:

```
/onboard
```

Claude will interview you about your project. It asks things like:
- What are you building?
- What tools or languages are you using?
- What's your workflow like?

Just answer honestly. There are no wrong answers. Claude uses your
responses to prepare the briefings that the cabinet needs — who you are,
what you're building, where things live, what matters to you. If you
don't know the answer to something, say so — Claude will use sensible
defaults.

## Each session

Once you're set up, there are really only two commands to remember:

### Start a session: `/orient`

When you sit down to work, type `/orient`. Claude reads the briefing:
- What happened in previous sessions
- What's on your plate
- What needs attention
- What to work on next

### End a session: `/debrief`

When you're done working, type `/debrief`. Claude:
- Records what was accomplished
- Closes out finished tasks
- Captures any lessons learned
- Prepares the briefing for next time

### That's the core habit

`/orient` → do work → `/debrief`. Repeat. Everything else is optional.

## Other useful commands

Type `/menu` to see everything available. Here are the highlights:

| Command | What it does |
|---------|-------------|
| `/plan` | Create a structured plan — cabinet members critique it before you build |
| `/audit` | Convene the cabinet for a full quality review of your project |
| `/investigate` | Systematically explore a question or problem |
| `/cabinet` | Browse your expert cabinet members or consult one by name |
| `/work-tracker` | Open the work tracking UI to review projects and tasks |
| `/orient-quick` | Fast version of orient — just the essentials |
| `/debrief-quick` | Fast version of debrief — just close things out |

## Multiple related projects

Each project folder gets its own Claude Cabinet setup. Install it in
each folder separately — each project gets its own briefings, cabinet
configuration, work tracking, and session history.

But they're not isolated. Claude Cabinet maintains a **project
registry** (`~/.claude/cc-registry.json`) that lists all your projects.
When you onboard a new project, Claude asks how it relates to your
other ones. During `/orient`, Claude is aware of your other projects
and can flag when work in one might affect another.

Your **user profile** (`~/.claude/CLAUDE.md`) also carries across every
project. Set it up once and Claude knows who you are everywhere.

## Updating

When a new version comes out, run the installer again:

```bash
cd ~/my-project
curl -fsSL https://raw.githubusercontent.com/orenmagid/claude-cabinet/main/install.sh | bash
```

It'll update the framework files without touching your project-specific
customizations. Then type `/cc-upgrade` in Claude Code and Claude will
walk you through what changed.

## Something went wrong?

- **Installer failed:** Make sure you're in the right folder and have
  internet access. Try again.
- **Claude doesn't recognize /orient:** Make sure you opened Claude Code
  in the project folder (not a parent or different folder).
- **Claude seems confused:** Try `/orient` to re-sync. If that doesn't
  help, try `/onboard` again — it won't erase anything, just refresh
  the briefings.
- **Need help:** Open an issue at
  https://github.com/orenmagid/claude-cabinet/issues
