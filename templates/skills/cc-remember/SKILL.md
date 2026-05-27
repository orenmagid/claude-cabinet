---
name: cc-remember
description: |
  Capture a memory into the project's built-in memory directory as a
  single descriptive file. Updates MEMORY.md index automatically.
  Use when: the user asks Claude to remember something, capture a
  lesson, save a decision, or pin a preference. Also use as the
  scripted alternative to the native "remember X" conversational
  write — this command ensures the memory is indexed.
argument-hint: "[--slug <slug>] <content>"
---

# /cc-remember — Capture a memory into MEMORY.md

## Purpose

CC's deterministic memory write path. Each invocation creates one
file under `~/.claude/projects/<slug>/memory/` and adds an entry to
MEMORY.md so the memory is discoverable by future sessions.

Use this command — or its programmatic equivalent
`scripts/write-memory-file.mjs` — whenever the user asks Claude to
remember something. The native "remember X" conversational path also
writes to the same directory but does NOT update MEMORY.md, which
makes the memory invisible to orient until the index is manually
fixed. `/cc-remember` is the indexed write path.

## Arguments

- `[--slug <slug>]` — explicit filename slug (lowercase, hyphens
  and underscores, e.g., `decided_built_in_memory`). If omitted,
  Claude generates a descriptive slug from the content.
- `[--title <title>]` — optional human-readable title for the file's
  `# Heading`. Defaults to a title-cased version of the slug.
- `[--description <one-liner>]` — short description for the MEMORY.md
  index entry. Defaults to the first line of content.
- `<content>` — the memory body itself (markdown).

## How to invoke

When you call this skill, generate a meaningful slug from the content
unless one was provided. Good slugs:

- Are 3–6 words separated by underscores
- Start with a category-style prefix when natural:
  `feedback_*`, `decision_*`, `lesson_*`, `project_*`, `user_*`,
  `constraint_*`
- Describe the memory's essence in 80 characters or fewer

Then run:

```bash
node ~/.claude-cabinet/.../scripts/write-memory-file.mjs \
  --slug "<slug>" \
  --title "<title>" \
  --description "<one-line summary>" \
  "<full content>"
```

The actual path to `write-memory-file.mjs` depends on the install
location. In a CC-installed project, it's at
`./scripts/write-memory-file.mjs` (CC ships it via the installer).

## Output

After writing, echo to the user:

> Wrote `<slug>.md` to `<memoryDir>`. Indexed in MEMORY.md.

If a collision occurred (file existed, suffix appended), say so:

> File `<slug>.md` already existed; wrote `<slug>_2026-05-27.md` instead.

## When NOT to use

- Don't use for in-session-only context that future sessions don't
  need — memory is for durable knowledge, not scratch work.
- Don't use for behavioral rules ("always do X") — those belong in
  `.claude/rules/`, not memory.
- Don't duplicate memories already captured. If a similar memory
  exists, edit that file rather than creating a new one.

## Examples

User says: "remember that we decided to use built-in memory instead of omega"
→ `/cc-remember --slug "decided_built_in_over_omega" "We decided to wind down omega-memory and migrate to Claude Code's built-in MEMORY.md + per-file curated style. Rationale: omega's knowledge graph was empty in practice, retrieval quality was poor, core features paywalled, and integration tax was recurring. See prj:efd10e1d for the full migration plan."`

User says: "remember I always use pnpm not npm"
→ `/cc-remember --slug "user_prefers_pnpm" "User prefers pnpm over npm. Use pnpm install / pnpm add / pnpm run by default."`

User says: "remember that orient takes about 30 seconds"
→ This is observational, probably not durable. Ask the user if they want it captured before invoking.

## Calibration

**Without this skill:** the user says "remember X", Claude writes a
flat .md file directly, MEMORY.md isn't updated, the memory is
invisible to next session's `/orient`. Net loss.

**With this skill:** same workflow, but the file is indexed and the
next session finds it via MEMORY.md.
