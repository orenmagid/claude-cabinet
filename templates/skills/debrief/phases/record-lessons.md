# Record Lessons — Route Session Outputs to Their Real Homes

This is debrief's second irreducible purpose: make sure the next session
is smarter than this one. Without it, the system does work but doesn't
learn from it.

Lessons are perishable. A lesson captured while context is fresh is
worth ten captured from memory next week.

## The Routing Principle

Every session output has **exactly one primary home**. The home must
have a forcing function — something that keeps the content accurate
when the code it describes changes. Loose `.md` files next to code
are the wrong home: they rot silently because nothing invalidates
them when the system evolves.

**Each output has one home. Don't double-store.** A decision stored
in omega doesn't also need a `.md` file. A constraint documented in
CLAUDE.md doesn't also need an omega entry "for backup." Duplication
just creates two things to keep in sync.

## Routing Decision Tree

For each thing you'd want future sessions to know, pick the single
best home:

### Decisions — "we chose X over Y because Z"

Architectural choices, tradeoff resolutions, accepted gaps, rejected
alternatives.

**Primary home:** omega `decision` memory. Omega has contradiction
detection — when a later decision supersedes this one, the old entry
can be marked `status=superseded` instead of silently rotting.

```bash
echo '{"text": "the decision + why", "type": "decision"}' | \
  ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py store
```

**Also add to CLAUDE.md** only if the decision is load-bearing enough
that *every* session needs to know it at startup (not just sessions
that touch the relevant code). Examples: "auth is per-user via FastAPI
Users (no shared passwords)" is load-bearing. "We rejected a specific
library option after evaluation" is not — omega is enough.

### Project constraints / conventions / gotchas

Environmental quirks, dev-workflow requirements, "this project has a
weird setup" facts.

**Primary home:** inline in `CLAUDE.md` or the project briefing. These
files get edited when the code changes — the forcing function is that
they're load-bearing for every session, so staleness surfaces fast.

Use omega `constraint` type only for cross-project patterns (e.g.,
"in any project with nested package.json..."). Project-specific
constraints belong inline.

### Conditional revisits — "do X later when Y happens"

"If we ever get multiple concurrent users, add a token blocklist."
"When curl becomes annoying, build a /settings UI."

**Primary home:** pib-db deferred action with `trigger_condition`.

```
pib_create_action text="..." status="deferred" trigger_condition="..."
```

Orient's deferred-check phase re-evaluates these every session. If the
condition has fired, the user gets asked; if it's obsolete, it gets
marked so. No silent rot.

### CC upstream friction embedded in a project observation

Sometimes a project-scoped observation contains a CC-applicable piece:
"in this project auth tests are hard, AND cabinet-qa should flag this
pattern in any auth work." That's two things, not one.

**Split it.** Route the project piece to its home (omega / CLAUDE.md /
trigger). Route the CC piece to the upstream-feedback phase (step 11)
where it will be drafted and delivered. Don't bury the upstream piece
inside a project decision doc — it will never find its way home.

### Lessons, gotchas, discoveries (not decisions, not constraints)

"We learned that X behaves differently from docs." "This pattern
works." "The CI was green but prod failed because…"

**Primary home:** omega `lesson` memory. Same forcing function as
decisions — superseded lessons can be marked and surfaced.

### User preferences

Style choices, workflow preferences, corrections the user made.

**Primary home:** omega `preference` memory.

## The Anti-Pattern: Loose Project-Scoped .md Files

**Do not write `feedback-project-*.md`, `decision-*.md`, or similar
loose .md files as the primary record of a session output.** This
pattern has been observed to rot — in one audited case, 4 of 5 such
files went stale within 7 days because the underlying code changed
and the files had no forcing function to catch it.

If you are tempted to write a loose .md file:
- Is it a decision? → omega `decision`
- Is it a constraint everyone needs? → CLAUDE.md / briefing
- Is it a conditional revisit? → pib-db deferred trigger
- Is it CC upstream friction? → upstream-feedback phase
- None of the above? → it probably doesn't need recording at all

## Before Writing — Contradiction Check

For each memory you're about to write, query omega for existing
entries on the same topic:

```bash
~/.claude-cabinet/omega-venv/bin/omega query "topic keywords" --limit 5
```

If an existing entry contradicts or is superseded by the new one,
mark the old one:

```bash
~/.claude-cabinet/omega-venv/bin/omega update <old-id> --status superseded
```

This is the forcing function that turns omega into a living record
instead of another pile of rotting notes.

## When Omega Is Not Available

If `~/.claude-cabinet/omega-venv/bin/python3` is missing AND the
memory module is not installed (check `.ccrc.json`), fall back to
flat markdown memory in `~/.claude/projects/...`. But recognize
this fallback has the same rot problem — prefer CLAUDE.md for
anything load-bearing and pib-db triggers for anything conditional.

If the memory module IS installed but omega is broken, surface this
in the debrief report:

> **⚠ Memory module is installed but omega is not working.**
> Decisions/lessons from this session were saved to flat markdown
> instead. Run `npx create-claude-cabinet` to rebuild the omega venv.

## What NOT to Record — Anywhere

- Code patterns derivable by reading current files
- Git history (use `git log`)
- Debugging solutions (the fix is already in the code; the commit
  message has the context)
- Anything already in CLAUDE.md files
- Ephemeral task details only relevant to this session
- "We made progress on X" session summaries — that's what git is for

## Report What Was Routed

Tell the user what went where so they can audit the routing:

```
Routed this session:
- 1 decision → omega mem-xxxxx (JWT revocation tradeoff)
- 1 constraint → article-rewriter/CLAUDE.md (tsc must run from frontend)
- 1 deferred trigger → pib-db act:xxxxxxxx (add blocklist if multi-user)
- 1 upstream piece → CC feedback outbox (cabinet-qa testability)
```

This is also how you catch routing errors: if everything ended up in
omega, the routing discipline didn't actually run.
