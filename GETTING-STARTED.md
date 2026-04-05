# Getting Started with Claude on Rails

This guide assumes you have Claude Code installed (the desktop app or CLI)
and a terminal. That's it. No programming experience needed.

## What is this?

Claude on Rails gives Claude a workflow: a way to start sessions informed,
plan work before doing it, review quality, and close sessions properly.
Without it, every conversation with Claude starts from scratch. With it,
Claude remembers what happened last time, knows what's on your plate, and
follows a structured process.

It works for any project — code, writing, research, business planning.
If you're using Claude Code to build or manage something over multiple
sessions, this helps.

## Do I need this?

The simplest test: **are you coming back tomorrow?**

If you're working on something that will take more than one sitting —
an app, a website, a research project, a business you're building —
then every time you start a new conversation with Claude, you lose
context. You end up re-explaining what you're doing, what you decided
last time, what's left. The bigger the project gets, the more time
you spend catching Claude up instead of making progress.

Claude on Rails fixes that. It gives Claude a memory, a workflow, and
a habit of closing loops. You sit down, say `/orient`, and Claude
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
curl -fsSL https://raw.githubusercontent.com/orenmagid/claude-on-rails/main/install.sh | bash
```

The installer handles everything:
- If you don't have git or Node.js, it installs them (may ask for your
  Mac password — that's normal)
- It sets up a git repository in your folder if there isn't one
- It installs all the Claude on Rails features
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
responses to customize how it works with you. If you don't know the
answer to something, say so — Claude will use sensible defaults.

## Daily use

Once you're set up, there are really only two commands to remember:

### Start a session: `/orient`

When you sit down to work, type `/orient`. Claude will:
- Review what happened in previous sessions
- Check what's on your plate
- Tell you what needs attention
- Suggest what to work on

Think of it as your morning briefing.

### End a session: `/debrief`

When you're done working, type `/debrief`. Claude will:
- Record what was accomplished
- Close out finished tasks
- Capture any lessons learned
- Note anything left for next time

Think of it as closing out the day.

### That's the core habit

`/orient` → do work → `/debrief`. Repeat. Everything else is optional.

## Other useful commands

Type `/menu` to see everything available. Here are the highlights:

| Command | What it does |
|---------|-------------|
| `/plan` | Create a structured plan before doing complex work |
| `/audit` | Run expert quality reviews on your project |
| `/investigate` | Systematically explore a question or problem |
| `/orient-quick` | Fast version of orient — just the essentials |
| `/debrief-quick` | Fast version of debrief — just close things out |

## Multiple related projects

Each project folder gets its own Claude on Rails setup. Install it in
each folder separately — each project gets its own context, work
tracking, and session history.

But they're not isolated. Claude on Rails maintains a **project
registry** (`~/.claude/cor-registry.json`) that lists all your projects.
When you onboard a new project, Claude asks how it relates to your
other ones. During `/orient`, Claude is aware of your other projects
and can flag when work in one might affect another.

Your **user profile** (`~/.claude/CLAUDE.md`) also carries across every
project. Set it up once and Claude knows who you are everywhere.

## Updating

When a new version comes out, run the installer again:

```bash
cd ~/my-project
curl -fsSL https://raw.githubusercontent.com/orenmagid/claude-on-rails/main/install.sh | bash
```

It'll update the framework files without touching your project-specific
customizations. Then type `/cor-upgrade` in Claude Code and it'll
explain what changed.

## Something went wrong?

- **Installer failed:** Make sure you're in the right folder and have
  internet access. Try again.
- **Claude doesn't recognize /orient:** Make sure you opened Claude Code
  in the project folder (not a parent or different folder).
- **Claude seems confused:** Try `/orient` to re-sync. If that doesn't
  help, try `/onboard` again — it won't erase anything, just refresh
  the setup.
- **Need help:** Open an issue at
  https://github.com/orenmagid/claude-on-rails/issues
