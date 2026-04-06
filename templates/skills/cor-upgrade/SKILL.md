---
model: opus
name: cor-upgrade
description: |
  Conversational upgrade when Claude Cabinet updates. Runs the installer to
  mechanically update all upstream-owned files, then walks through what changed
  conversationally — explaining improvements, handling _briefing.md updates,
  new phase file opportunities, and schema migrations. Intelligence is the
  merge strategy for the parts that need it. Use when: "cor-upgrade",
  "update CoR", "new skeletons", "/cor-upgrade".
related:
  - type: file
    path: .claude/skills/cor-upgrade/phases/pre-upgrade.md
    role: "Pre-upgrade checks and state capture"
  - type: file
    path: .claude/skills/cor-upgrade/phases/explain-changes.md
    role: "How to explain what changed"
  - type: file
    path: .claude/skills/cor-upgrade/phases/adapt.md
    role: "Handle non-manifest concerns — _briefing.md, phase files, schema"
---

# /cor-upgrade — Conversational Claude Cabinet Upgrade

## Purpose

This is the methodology's central claim made operational: **intelligence
is the merge strategy** — but only where intelligence is needed.

CoR upgrades have two layers:

1. **Mechanical layer.** Skeleton SKILL.md files, hook scripts, utility
   scripts — these are upstream-owned and tracked in `.corrc.json`. The
   installer overwrites them deterministically. No conversation needed.
   The upstream guard hook (PreToolUse on Edit|Write) enforces this
   boundary at runtime — Claude cannot accidentally modify these files.

2. **Conversational layer.** Everything the installer can't handle:
   explaining what changed and why, updating `_briefing.md` sections that
   new features reference, identifying new phase file opportunities,
   running schema migrations, adapting project context to upstream
   improvements. This is where intelligence is the merge strategy.

The old approach tried to use conversation for everything — including
mechanical file updates. That was fragile. Now the installer handles
the deterministic parts, and this skill focuses entirely on the parts
that actually need reasoning.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration is generic. Your project defines specifics in phase files
under `phases/`.

### Phase File Protocol

Phase files have three states:

| State | Meaning |
|-------|---------|
| Absent or empty | Use this skeleton's **default behavior** for the phase |
| Contains only `skip: true` | **Explicitly opted out** — skip this phase entirely |
| Contains content | **Custom behavior** — use the file's content instead |

The skeleton always does something reasonable when a phase file is absent.
Phase files customize, not enable. Use `skip: true` when you actively
don't want a phase to run — not even the default.

### Write Protection

Manifest-tracked files (skeleton SKILL.md files, hooks, scripts) are
protected by the upstream guard hook. Claude cannot Edit or Write to
them during normal operation. This is intentional — these files are
upstream-owned and should only change through the installer.

**What this means for upgrades:**
- The installer (running via Bash as a Node.js/shell process) bypasses
  the hook because it doesn't use Claude's Edit/Write tools
- After the installer runs, all manifest-tracked files are current
- This skill then handles everything the installer doesn't touch:
  _briefing.md, phase files, schema, and explanation

### Skeleton/Extension Separation

Skeleton files (SKILL.md, hooks, scripts) are upstream-owned, manifest-
tracked, and write-protected. They evolve through the installer.

Phase files and _briefing.md are project-owned. They are NEVER in the
manifest, NEVER write-protected, and NEVER overwritten by the installer.
They evolve through conversation — this skill, /onboard, or direct
editing.

This separation is enforced mechanically (manifest + hook), not just
by convention. The upgrade is safe because the boundary is real.

## Workflow

### 1. Pre-Upgrade Snapshot

Read `phases/pre-upgrade.md` for pre-upgrade checks.

**Default (absent/empty):**
- Read `.corrc.json` to capture the current version and module set
- Note which phase files exist and have content (these won't be touched)
- Note any `_briefing.md` sections that may need updating
- If the project has a work tracker DB, note the current schema

Output: a snapshot of the project's current state, used to explain
what changed after the installer runs.

### 2. Run the Installer

Run the installer via Bash to mechanically update all upstream files:

```
# Shell installer (re-downloads latest from npm registry)
curl -fsSL https://raw.githubusercontent.com/orenmagid/claude-on-rails/main/install.sh | bash

# Or npm installer (if Node.js available)
npx create-claude-cabinet
```

The installer:
- Overwrites all manifest-tracked files (skeletons, hooks, scripts)
- Preserves files NOT in the manifest (phase files, _briefing.md)
- Updates `.corrc.json` with new version, hashes, and any new files
- Adds new skills/hooks/scripts that didn't exist in the old version

**This is a Bash command, not an Edit/Write operation.** It bypasses
the upstream guard hook because it runs as a separate process using
the filesystem directly. This is by design — the installer is the
authorized update path for manifest-tracked files.

### 3. Explain What Changed

Read `phases/explain-changes.md` for how to present changes.

**Default (absent/empty):** Compare the pre-upgrade snapshot against
the new state:

1. **Version jump.** What version did we come from? What version are
   we on now?

2. **Changed skeletons.** For each SKILL.md that the installer updated,
   explain what changed and why — not line-by-line diffs, but semantic
   summaries. "The debrief skill now includes an upstream feedback phase
   that surfaces CoR friction during debrief sessions." "The plan skill's
   critique step now pulls from more cabinet members by default."

3. **New files.** Any skills, hooks, or scripts that were added for the
   first time. Explain what they do and whether they need any setup.

4. **New phase opportunities.** If new skeletons reference phase files
   that the project doesn't have yet, mention them as opportunities.
   "The orient skeleton now supports a `calendar-check.md` phase — you
   could create one to check upcoming deadlines."

5. **Deprecations or removals.** If anything was removed upstream,
   explain why and what replaces it.

Walk through each category conversationally. The user should understand
what they're getting, not just that files changed.

### 4. Adapt Non-Manifest Concerns

Read `phases/adapt.md` for how to handle the conversational layer.

**Default (absent/empty):** After explaining changes, handle anything
the installer couldn't:

#### _briefing.md Updates
If new skeletons reference `_briefing.md § Section` names that the
project's `_briefing.md` doesn't have, propose adding them. New features
often depend on briefing sections — e.g., a new cabinet member might
reference `§ Friction Captures` which the project hasn't defined yet.
Show the section template from `_briefing-template.md` and help the
user fill it in.

#### Phase File Opportunities
For each skeleton that changed, check its phase files against the
project's `phases/` directory. There are three cases:

1. **Existing phase file, workflow changed around it.** The project
   customized this phase and the skeleton shifted. Discuss the
   implications: "The orient skeleton reorganized its steps — your
   custom `health-checks.md` phase still works, but it now runs
   earlier in the workflow. Is that okay?"

2. **New phase the skeleton now references.** The upstream added a
   phase that didn't exist before. Explain what the default behavior
   is and what customizing it would look like. Don't push — just
   surface the opportunity. "The debrief skeleton now has an
   `upstream-feedback` step. It runs by default — here's what it does.
   If you ever want to change that behavior, you'd create
   `phases/upstream-feedback.md`."

3. **Existing default that changed meaningfully.** The project uses
   the default (no phase file) and the default behavior shifted. The
   project gets the improvement automatically, but mention it so they
   know. If the new default does something they might not want, suggest
   creating a phase file to customize or skip it. "The plan skeleton's
   default research phase now reads test files too. You've been using
   the default — you'll get this automatically. If that's too noisy,
   create `phases/research.md` to scope it."

4. **Default that won't fit the project.** Read `_briefing.md` and
   compare against what the default actually does. If there's a
   mismatch, say so and offer to create the phase file now. "The
   orient skeleton added a `work-scan` phase. The default reads git
   history — but your `_briefing.md` says you use Linear. The default
   won't see your tickets. Want to create `phases/work-scan.md` that
   checks Linear?" This isn't speculation — it's reading both sides
   and spotting the gap.

**Don't enumerate every absent phase file.** That's `/onboard`'s job.
The upgrade skill only surfaces phase opportunities that are *relevant
to what changed* in this upgrade — including cases where the project's
context makes a default obviously insufficient.

#### Schema Migrations
If the upstream schema has new columns or tables:
- Detect the difference between the shipped schema and the project's DB
- Generate `ALTER TABLE` / `CREATE TABLE` SQL
- Present for review
- Apply only after explicit confirmation

#### New Module Adoption
If the upgrade added modules the project hadn't installed before,
walk through what they do and whether to keep them.

Present a summary when done: what was mechanically updated, what was
adapted conversationally, what the user might want to customize next.

### 5. Discover Custom Phases

After running the core phases above, check for any additional phase
files in `phases/` that the skeleton doesn't define. These are project-
specific extensions. Each custom phase file declares its position in
the workflow. Execute them at their declared position.

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `pre-upgrade.md` | Default: read .corrc.json, note phase files, note _briefing.md | Pre-upgrade state capture |
| `explain-changes.md` | Default: semantic summary of version jump, changed skeletons, new files | How to present what changed |
| `adapt.md` | Default: _briefing.md sections, phase implications, schema, new modules | How to handle non-manifest concerns |

## Proactive Trigger

The upgrade skill doesn't have to wait for the user to invoke it.
Orient can detect when upstream CoR has a newer version than what's
in `.corrc.json` and surface "CoR updates available" in the briefing.
This is a hint, not a blocker — the user decides when to run /cor-upgrade.

The drift check script (`scripts/cor-drift-check.cjs`) can also detect
if manifest-tracked files have been modified outside the installer,
though the upstream guard hook should prevent this during normal
Claude Code operation.

## Extending

To customize a phase: write content in the corresponding `phases/` file.
To skip a phase: write only `skip: true`.
To add a phase the skeleton doesn't define: create a new file in
`phases/` with a description of when it runs relative to the core
phases. Claude reads whatever phase files exist at runtime.

Examples of phases mature projects add:
- Changelog generation (produce a human-readable summary of what changed)
- Rollback plan (capture how to revert each change if something breaks)
- Downstream notification (update team members about process changes)
- Compatibility check (verify that project extensions still work after
  skeleton updates)

## Calibration

**Core failure this targets:** Process improvements published upstream
never reach adopted projects, or reach them but nobody understands
what changed.

### Without Skill (Bad)

New CoR version is out. The user re-runs the installer. Files update
silently. The user has no idea what changed — was it just bug fixes?
New features? Did a skill they rely on change its workflow? They also
don't realize the new debrief skill references a `§ Friction Captures`
section in _briefing.md that their project doesn't have, so the upstream
feedback phase silently does nothing. Three weeks later they wonder
why no friction is being captured.

### With Skill (Good)

New CoR version is out. The user runs `/cor-upgrade`. The installer
updates all upstream files mechanically — fast, deterministic, safe
(phase files untouched). Then Claude explains: "You went from v0.4.1
to v0.5.0. The big change: debrief now has an upstream feedback phase
that captures CoR friction. It references `_briefing.md § Friction
Captures` — let's add that section to your briefing file." "The plan
skill's critique step now uses three cabinet members instead of one. Your
existing phase files are fine — this is a default behavior change."
"There's a new `investigate` skill for deep-dive debugging. Want to
try it?" Everything is explained. Non-manifest concerns are handled.
The project gets better without confusion.
