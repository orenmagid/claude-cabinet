---
type: feature-request
source: flow (consuming project)
date: 2026-04-08
component: memory module / hooks
---

## PreToolUse hook to enforce omega-primary memory writes

**Problem:** The debrief skill's `record-lessons.md` phase says "omega-primary"
— write lessons to omega, fall back to flat markdown only if omega is
unavailable. But nothing *enforces* this. During a Flow session today, Claude
wrote lessons to `.claude/memory/*.md` flat files despite omega being fully
available. The user caught it and was (rightly) upset.

This will keep happening because the instruction is guidance (~60-80%
compliance), not a guardrail. Every session that writes to flat markdown
when omega is available degrades memory quality — flat files don't get
semantic search, deduplication, consolidation, or the knowledge graph.

**Proposed solution:** A `PreToolUse` hook that ships with Claude Cabinet's
memory module. When omega is available, it blocks writes to flat markdown
memory paths and redirects to `omega_store()`.

**Hook behavior:**

1. **Trigger:** `PreToolUse` on `Edit` or `Write` tools
2. **Match:** File path matches `.claude/memory/*.md` or
   `.claude/projects/*/memory/*.md` (excluding `MEMORY.md` index files,
   which are structural)
3. **Check:** Is omega available? (e.g., check for
   `~/.claude-cabinet/omega-venv/bin/python3` and the adapter script)
4. **If omega available:** Block the write. Return a message like:
   "Omega is active — use `omega_store()` instead of writing to flat
   markdown memory files. Flat markdown is the fallback when omega is
   unavailable."
5. **If omega unavailable:** Allow the write (flat markdown IS the
   correct fallback)

**Why this belongs in CC, not consuming projects:**

- Every project with the memory module installed should get this
  automatically — it's not project-specific logic
- The hook enforces a CC-level convention (omega-primary memory)
- Consuming projects shouldn't need to independently discover and
  implement this guard
- Ships once in CC, applies everywhere via `npx create-claude-cabinet`

**Scope:** Only blocks memory file writes. Does NOT block:
- `MEMORY.md` index updates (structural, not memory content)
- Pattern files in `memory/patterns/` (these are enforcement pipeline
  artifacts, not semantic memories)
- Any other `.claude/` file writes

**Incident context:** During a debrief in the Flow project, Claude stored
3 session lessons as flat `.claude/memory/` files instead of calling
`omega_store()`. The omega venv was healthy and the adapter was working.
The debrief skill's phase file said omega-primary, but without enforcement,
Claude defaulted to the familiar flat-file pattern. User had to intervene
manually to catch and correct this.
