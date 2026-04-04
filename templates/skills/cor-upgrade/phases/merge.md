# Merge — Intelligent Upgrade Conversation

THE INTELLIGENCE. For each change detected by diff-upstream, walk
through a conversational merge: explain, examine, propose, dialogue.

When this file is absent or empty, the default behavior is: process
each change using the category-based strategy defined in the skeleton
SKILL.md. To explicitly skip merging (just list changes without
proposing anything), write only `skip: true`.

## The Merge Loop

For each change in the categorized list:

### 1. Explain What Changed and Why

Read the upstream change in full. Don't summarize from the diff — read
the actual new content. Infer purpose from:
- The change itself (what does it add, remove, or alter?)
- Surrounding documentation (did a README or methodology essay mention it?)
- Commit messages if accessible
- The pattern of changes (if several skeletons gained the same phase,
  that's a methodology-wide shift)

Communicate at the level of intent, not lines: "The orient skeleton now
checks for stale deferred items because projects found that deferred
work was being forgotten" — not "lines 140-155 were added."

### 2. Examine the Project's Current Implementation

Before proposing anything, understand how the project handles this area:
- Read the relevant phase files (customized? default? skipped?)
- Check if the project has custom phases that address the same concern
- Look at related memory patterns or feedback
- Understand why the project's current approach exists

### 3. Propose Adaptation

Based on the change category:

**Category 1 (new default):** "This applies automatically since you're
using the default. Here's what it adds: [description]. No action needed
unless you want to customize it."

**Category 2 (changed default):** "The default behavior for [phase]
changed from [old] to [new]. You're currently using the default. The
new version [explanation]. Adopt the new default, or would you prefer
to pin the old behavior by writing it into your phase file?"

**Category 3 (new phase):** "Upstream added a [name] phase to [skill].
It handles [description]. Your project [does/doesn't] have something
similar. Want to opt in, or skip it for now?"

**Category 4 (changed workflow):** "The [skill] skeleton's workflow
changed: [description]. Your project has customized [these phases].
Here's how I'd adapt: [proposal]. Let's walk through it."

**Category 5 (new skill):** "There's a new [name] skill available. It
handles [description]. Adopting it would involve [steps]. Want to
explore it, or skip for now?"

**Category 6 (schema migration):** "The upstream schema adds [columns/
tables]. Here's the migration SQL: [SQL]. This would enable [features].
Want me to apply it?"

### 4. Dialogue

Wait for the user's response. They may:
- Accept as proposed
- Want modifications (co-author the adaptation)
- Skip with a reason (record why for future upgrades)
- Ask questions (answer from upstream context)

## CRITICAL: Phase File Protection

Phase files are NEVER overwritten by this process. The merge handles:
- Skeleton SKILL.md updates (the generic orchestration)
- New capabilities and defaults
- Schema migrations
- New skills and perspectives

It does NOT handle:
- Replacing project phase files with upstream examples
- Overwriting custom perspectives
- Changing project-specific hook configurations

If an upstream change interacts with a phase file's content (e.g., a
skeleton now references a concept the phase file also addresses), propose
a **collaborative edit** — show the user what you'd change in their
phase file and why, get approval before touching it.

## Batch vs Interactive

For small upgrades (1-3 changes), walk through each one interactively.
For large upgrades (many changes), group by category and handle
auto-adopt items (category 1) in batch, then walk through the rest
individually.
