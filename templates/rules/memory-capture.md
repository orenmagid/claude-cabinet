# Memory Capture Rules

When omega memory is active (check: `~/.claude-cabinet/omega-venv/bin/python3`
exists and `scripts/cabinet-memory-adapter.py` exists), these rules govern
what gets captured and when.

## During Sessions — What to Capture

Capture to omega when you observe any of these during a session:

**Decisions with reasoning.** When the user makes a non-obvious choice
(architecture, naming, tradeoffs, tool selection), capture the decision
AND the reasoning. "Chose SQLite over Postgres because single-user,
no server dependency" — not just "uses SQLite."

**Discovered constraints.** When something that seemed possible turns
out to have a limitation, gotcha, or prerequisite. "Python venv on
Debian requires separate python3-venv package" — the kind of thing
that wastes 30 minutes if you don't know it.

**User preferences revealed through correction.** When the user says
"no, not like that" or redirects your approach, capture what they
actually want. "User prefers single bundled PRs for refactors, not
many small ones."

**Pattern establishment.** When a convention is established for the
first time — naming pattern, file organization, workflow step. Not
the convention itself (that's in the code), but that it was a
deliberate choice.

## How to Capture

Use the adapter — never call omega directly from shell:

```bash
echo '{"text": "the memory", "type": "decision"}' | \
  ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py store
```

Memory types: `decision`, `lesson`, `preference`, `constraint`, `pattern`

## What NOT to Capture

- Code patterns visible by reading current files
- Git history (use `git log`)
- Anything already in CLAUDE.md or briefing files
- Ephemeral debugging details
- Information that changes frequently (use state files instead)

## Capture Cadence

Do NOT capture after every interaction. Capture when something worth
remembering actually happens. Most messages in a session produce nothing
worth storing. A typical session might generate 0-3 memories.

Over-capturing degrades retrieval quality. When in doubt, don't capture.
The debrief sweep catches anything important that was missed.
