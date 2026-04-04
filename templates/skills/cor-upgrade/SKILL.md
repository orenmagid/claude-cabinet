---
name: cor-upgrade
description: |
  Conversational upgrade when new Claude on Rails skeletons arrive. Detects current
  adoption state, diffs against upstream, and for each change walks through
  an intelligent merge — conversation not mechanical copy. Intelligence is
  the merge strategy. Use when: "cor-upgrade", "update CoR", "new skeletons",
  "/cor-upgrade".
related:
  - type: file
    path: .claude/skills/cor-upgrade/phases/detect-current.md
    role: "Inventory current adoption state"
  - type: file
    path: .claude/skills/cor-upgrade/phases/diff-upstream.md
    role: "Semantic diff against upstream CoR"
  - type: file
    path: .claude/skills/cor-upgrade/phases/merge.md
    role: "Intelligent merge strategy — the core of the skill"
  - type: file
    path: .claude/skills/cor-upgrade/phases/apply.md
    role: "Apply approved changes"
---

# /cor-upgrade — Conversational Claude on Rails Upgrade

## Purpose

This is the methodology's central claim made operational: **intelligence
is the merge strategy.**

Traditional frameworks distribute as code. You install a new version,
run a migration script, resolve merge conflicts in config files, and hope
nothing breaks. The upgrade path is mechanical — diff, patch, pray. This
works for code because code has precise semantics. It fails for process
because process is always adapted to context.

AI-native methodology distributes as conversation. The upstream CoR
package publishes new skeletons, updated defaults, additional perspectives,
schema migrations. But the project has already adapted those skeletons —
customized phase files, tuned perspectives, extended workflows. A
mechanical merge would destroy the adaptations. A manual merge would
require the user to understand both what changed upstream and how their
project diverged, then mentally compose the two. Neither works.

The upgrade skill reads both sides — the upstream change and the
downstream context — and translates improvements into the project's
idiom. It explains what changed and why, examines how the project
currently handles that area, and proposes an adaptation that preserves
local customizations while incorporating upstream improvements. The
user confirms, modifies, or rejects each proposal. Nothing is applied
silently.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration (detect, diff, merge, apply) is generic. Your project
defines specifics — where upstream lives, what's adopted, how to
present changes — in phase files under `phases/`.

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

### Skeleton/Extension Separation

This skill understands a critical boundary: **skeleton SKILL.md files may
update, but phase files are NEVER overwritten by upstream changes.**

Skeleton files (SKILL.md) contain the generic orchestration — the workflow
steps, the phase protocol, the default behaviors. These are authored by
CoR and may improve over time. When upstream publishes a better skeleton,
the upgrade skill can propose replacing it.

Phase files contain the project's customizations — what specific files to
read, what specific APIs to call, what specific checks to run. These are
authored by the project adopter (you and Claude together). Upstream has
no knowledge of them and no authority to change them. Even if upstream
adds a new phase file as an example or default, it never overwrites an
existing project phase file.

This separation is what makes upgrades safe. The skeleton evolves; the
customizations persist. The merge intelligence sits at the boundary
between the two.

## Workflow

### 1. Detect Current State

Read `phases/detect-current.md` for how to inventory the project's
current CoR adoption.

**Default (absent/empty):** Scan the project for CoR artifacts:
- For each skill in `.claude/skills/`: is it a CoR skeleton? Which
  phase files are customized vs using defaults vs explicitly skipped?
- Which perspectives are adopted? Which groups configured?
- What hooks are installed from CoR?
- What pib-db schema version is in use (check for known columns)?
- What's in `memory/patterns/`?

Output: a structured manifest of current adoption state, consumed by
the diff phase.

### 2. Diff Against Upstream

Read `phases/diff-upstream.md` for how to compare the project's state
against the upstream CoR package.

**Default (absent/empty):** Look for `.pib-upstream/` in the project
root (staged by `npx create-claude-rails upgrade`). For each
adopted skeleton: perform a semantic diff of SKILL.md — section by
section, not line by line. Identify new phases, changed workflows,
updated defaults. For non-adopted skills: list what's new and available.
For perspectives: detect new or updated ones in upstream. For schema:
compare `pib-db-schema.sql` columns against the project's actual DB
tables.

Output: a categorized list of changes, each tagged with a change
category (see below).

### 3. Merge — The Intelligence

Read `phases/merge.md` for how to handle each detected change. This is
the core of the skill — where conversation replaces mechanical patching.

**Default (absent/empty):** For each change detected in the diff phase:

1. **Explain** what changed and why. Read the upstream change, infer its
   purpose from context (commit messages, surrounding documentation,
   the change itself). Don't just say "line 47 changed" — say "the
   orient skeleton now includes a calendar-check phase because projects
   found that missing upcoming deadlines was a recurring failure mode."

2. **Examine** how the project currently handles this area. Read the
   relevant phase files, skill definitions, and configuration. Understand
   the project's adaptation before proposing anything.

3. **Propose** an adaptation. Based on the change category (see below),
   recommend one of: adopt as-is, adapt to fit the project's patterns,
   or skip with a reason. Explain what each option would mean concretely.

4. **Dialogue.** The user decides. This is conversation, not mechanical
   merge. If the user wants something different from what you proposed,
   co-author the adaptation together.

#### Change Categories

Each detected change falls into one of six categories. The category
determines the default merge strategy:

| # | Category | Default Strategy |
|---|----------|-----------------|
| 1 | **New default behavior** — a phase the project uses defaults for gains a new default | Auto-adopt. The project was already trusting upstream defaults; the new default is strictly additive. Mention it but don't require confirmation. |
| 2 | **Changed default behavior** — a phase the project uses defaults for has its default modified | Explain + propose. The project trusted the old default; the new one is different. Show what changed and let the user decide. |
| 3 | **New phase added to skeleton** — upstream added a phase that didn't exist before | Explain what the phase does, propose opt-in. New phases start as "absent" (using default or skipped), so adoption is always explicit. |
| 4 | **Changed skeleton workflow** — the SKILL.md orchestration itself changed | The most sensitive category. Examine the project's phase files and any custom phases. Co-author the adaptation — don't just replace the skeleton. |
| 5 | **New skeleton skill available** — upstream published a skill the project hasn't adopted | Present what the skill does, what problem it solves, what adoption would involve. User decides whether and when to adopt. |
| 6 | **Schema migration** — upstream schema has new columns or tables | Detect the difference, generate ALTER TABLE / CREATE TABLE SQL, present for review, apply only after explicit confirmation. |

**CRITICAL:** Phase files are NEVER overwritten. The merge handles
skeleton SKILL.md updates and new capabilities. Project-specific
customizations in phase files are sacred — they represent the project's
adaptation of the methodology to its own context. If an upstream change
would interact with a phase file's content (e.g., a skeleton now
references a concept the phase file also addresses), the merge proposes
a collaborative edit, not a replacement.

### 4. Apply Approved Changes

Read `phases/apply.md` for how to apply the changes the user approved
in the merge phase.

**Default (absent/empty):**
- For skeleton-only changes: copy the updated SKILL.md from upstream,
  preserving the project's phase files untouched.
- For changes that interact with phase files: make collaborative edits
  as approved in the merge dialogue — show the diff before writing.
- For schema migrations: run the approved SQL against the project's DB.
- For new skills: copy the skeleton SKILL.md, create an empty `phases/`
  directory. The project customizes from there.
- Commit after each logical group of changes with a clear message
  describing what was upgraded and why.
- Present a summary: what was applied, what was skipped (with reasons),
  what the user might want to review or customize next.

### 5. Discover Custom Phases

After running the core phases above, check for any additional phase
files in `phases/` that the skeleton doesn't define. These are project-
specific extensions. Each custom phase file declares its position in
the workflow. Execute them at their declared position.

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `detect-current.md` | Default: scan .claude/skills/, perspectives, hooks, DB | How to inventory adoption state |
| `diff-upstream.md` | Default: compare against .pib-upstream/ (staged by CLI) | Where upstream lives and how to diff |
| `merge.md` | Default: explain + examine + propose for each change | How to handle each change category |
| `apply.md` | Default: copy skeletons, collaborative edits, SQL migrations | How to apply approved changes |

## Proactive Trigger

The upgrade skill doesn't have to wait for the user to invoke it.
Orient can detect when upstream CoR files are newer than the project's
adopted copies and surface "CoR updates available" in the briefing.
This is a hint, not a blocker — the user decides when to run /cor-upgrade.

To enable this, a project's orient `phases/health-checks.md` or a
custom orient phase can compare modification times between upstream
skeleton SKILL.md files and their adopted counterparts. When drift is
detected, orient mentions it. When the user is ready, they invoke
/cor-upgrade and the full conversational merge begins.

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
never reach adopted projects, or reach them as destructive overwrites
that erase hard-won customizations.

### Without Skill (Bad)

New CoR skeletons arrive. The user manually diffs files, trying to
figure out what changed. Some changes are obvious — a new skill directory
appeared. Others are subtle — a default behavior in an existing skeleton
shifted. The user copies files they think are updated, accidentally
overwrites a phase file they'd customized, doesn't notice a schema
migration is needed. Three sessions later, a skill fails because it
references a DB column that doesn't exist yet. The customization they
spent two sessions tuning is gone, replaced by the upstream default.

### With Skill (Good)

New CoR skeletons arrive. The user runs `/cor-upgrade`. Claude inventories
what's adopted, diffs against upstream, and walks through each change:
"The orient skeleton added a calendar-check phase. Your project doesn't
have calendar integration, so this would be a no-op — skip it for now?"
"The debrief skeleton's default inventory behavior now includes checking
for uncommitted stash entries. You're using the default here, so this
improvement applies automatically." "There's a new schema column for
deferred trigger conditions. Here's the ALTER TABLE — want me to apply
it?" Nothing is lost. Everything is explained. The project gets better
without getting broken.
