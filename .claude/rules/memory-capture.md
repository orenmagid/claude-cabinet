# Memory Capture Rules

Memory in CC lives in Claude Code's built-in auto-memory directory:
`~/.claude/projects/<project>/memory/`. Each memory is its own `.md`
file (per-file curated style), and `MEMORY.md` is the index that
tells Claude what's there.

## The canonical write path: `/cc-remember`

When the user asks Claude to remember something — explicitly ("remember
X") or implicitly (a decision, a lesson, a preference worth keeping) —
use the `/cc-remember` skill rather than writing a flat `.md` file
directly.

`/cc-remember` ensures:
- The new memory lands at `~/.claude/projects/<slug>/memory/<slug>.md`
- `MEMORY.md` gets a new entry in the "Curated entries (hand-authored)"
  section, so next session's `/orient` can find the memory
- Filename collisions are handled (suffix with date if needed)
- The write is atomic (temp + rename — safe under concurrent sessions)

Direct flat-`.md` writes work but skip the indexing step. The memory
becomes invisible to `/orient` until you manually update `MEMORY.md`.
The `memory-index-guard` PostToolUse hook will flag this when it
happens, but it's better to avoid the issue: **use `/cc-remember`**.

## What to capture

**Decisions with reasoning.** Architectural or process choices where
the "why" matters as much as the "what."

**Discovered constraints.** Limitations or gotchas that waste time
if you don't know them in advance.

**User preferences revealed through correction.** When the user
redirects your approach — capture what they actually want.

**Lessons learned.** Patterns that worked or didn't, especially ones
that surface across multiple sessions.

## What NOT to capture

- Code patterns visible by reading current files
- Git history (use `git log`)
- Anything already in CLAUDE.md or briefing files
- Ephemeral debugging details
- Information that changes frequently (use state files instead)

## In-session immediacy is not a memory problem

If a piece of guidance needs to apply *in this turn* (e.g., "always
use pnpm not npm"), it belongs in `.claude/rules/`, not memory.
Memory is for "what I learned six sessions ago that I want surfaced
when relevant." Rules are for "this is how this project works,
always."

The distinction matters because memory is loaded on demand via
MEMORY.md's index, while rules are loaded eagerly (or via path-scoped
frontmatter). If you need behavior to change this turn, write a rule.

## Capture Cadence

Over-capturing degrades retrieval quality. The test:
> *Would a future session benefit from knowing this?*

If yes, capture it. If it's just noise or ephemera, skip it.

## Validation

`scripts/validate-memory.mjs` checks structural integrity:
- MEMORY.md within Claude Code's 200-line / 25KB session-start budget
- Every memory file is indexed (no orphans)
- Every indexed file exists (no broken references)
- Topic-style files (migrated from omega) stay under 50KB

Wired into `/validate`. Also runs PostToolUse on memory writes via
`memory-index-guard.sh`.

## Migrated topic files (read-only legacy)

After the omega → built-in migration (CC v0.27.0), some memory
directories contain topic-style files alongside the per-file curated
ones: `decisions.md`, `lessons.md`, `cross-{project}.md`, etc. These
are the archived omega corpus, organized by type.

**Don't append to these.** Write new memories as new per-file curated
entries via `/cc-remember`. The migrated topic files are read-only
reference material — Claude consults them when MEMORY.md's index
points there for a relevant topic.
