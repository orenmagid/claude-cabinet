---
name: memory
description: |
  Browse, search, validate, and manage the project's built-in memory
  directory. Shows what's stored under
  `~/.claude/projects/[project]/memory/` — decisions, lessons,
  preferences, constraints, and migrated topic files. Use when:
  "what's in memory", "memory", "/memory", "show memories", "search
  memory", "find a memory about X", "validate memory". For writing
  memory, use /cc-remember.
user-invocable: true
---

# /memory — Built-In Memory Browser

## Mental Model

CC uses Claude Code's built-in auto-memory at
`~/.claude/projects/<slug>/memory/`. Each memory is one `.md` file
(per-file curated style); `MEMORY.md` is the index that tells Claude
what's there at session start.

**This skill is the reader.** Writing happens via `/cc-remember` or
debrief's record-lessons phase. Both use
`scripts/write-memory-file.mjs` to ensure MEMORY.md stays indexed.

## Mental Model

The new storage is plain markdown you can read and edit. There is one
folder per project. Read MEMORY.md to see what's there. Edit topic
files or curated files directly when an entry needs revision.

## Mode of operation

Parse the user's intent from their prompt:

### Browse (default — no arguments)

Read `MEMORY.md` at the project's memory dir and present the index
conversationally. List sections:
- **Topic files** (migrated from omega, if present) — `decisions.md`,
  `lessons.md`, `cross-{project}.md`, etc.
- **Curated entries** (per-file) — one entry per file with a
  descriptive title.

For each, name the file and what it covers (from the index entry).
Don't dump file contents unless asked.

Resolve the memory dir via:
```bash
node -e "console.log(require('./lib/project-context').resolveMemoryDir())"
```
Or use the platform default: `~/.claude/projects/<dashified-cwd>/memory/`.

### Search — user provides a topic

Grep across the memory dir. Two passes:

1. Title/description match (fastest):
   ```bash
   grep -i "<query>" ~/.claude/projects/<slug>/memory/MEMORY.md
   ```
2. Full-text match across all `.md` files:
   ```bash
   grep -i -l "<query>" ~/.claude/projects/<slug>/memory/*.md
   ```

Present the most-relevant matches (typically the title hits first).
For each, read the file and quote the relevant section. If the query
spans multiple matches, surface 3-5 and ask whether to dig deeper.

### Remember — user wants to store something

Redirect to `/cc-remember`. Don't write the file directly from this
skill — `/cc-remember` is the canonical write path because it updates
MEMORY.md's index. Direct writes bypass indexing and the memory
becomes invisible to next session's `/orient`.

```
Use /cc-remember to capture this. For example:
  /cc-remember --slug "decided_use_built_in" "We decided to ..."
```

If the user pushes through ("just do it yourself"), call
`scripts/write-memory-file.mjs` programmatically — that's the same
write path /cc-remember uses.

### Validate — user asks for a health check

Run the structural validator:
```bash
node scripts/validate-memory.mjs
```

Report the result. Pass: confirm "memory dir is healthy: <N> files,
<X> indexed, MEMORY.md within caps." Fail: list each violation and
suggest the fix (orphans → reference in MEMORY.md or delete; broken
references → restore the file or remove from index).

### Forget — user wants to remove a memory

**Step 1:** Identify the file. Search by content or filename:
```bash
ls ~/.claude/projects/<slug>/memory/ | grep -i "<term>"
grep -l "<content phrase>" ~/.claude/projects/<slug>/memory/*.md
```

**Step 2:** Show the user what matched. Confirm which file to delete.

**Step 3:** Delete the file and remove its index entry from MEMORY.md.
The file is just markdown — `rm path/to/file.md` plus an Edit on
MEMORY.md to strip the index line. Re-run `validate-memory.mjs`
afterward to confirm no orphan references remain.

For migrated topic files (`decisions.md`, `lessons.md`, etc.), don't
delete the whole file — Edit it to remove the specific dated entry,
then leave the file in place.

## Presentation

Keep it conversational. Don't dump raw file contents or grep output
verbatim — summarize. For browse, present the index sections with
short descriptions. For search, quote the most relevant matches and
their source files. For forget, always confirm before deleting.

## Calibration

**Without this skill:** the user has no easy way to inspect what's in
the memory dir, search for an old memory by topic, or clean up stale
entries. Memory accumulates without anyone looking at it.

**With this skill:** memory becomes browsable — the user can see what's
captured, find what they need, and prune what's wrong. The system
stays legible.
