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

**Each output has one home. Don't double-store.** A decision captured
via `/cc-remember` doesn't also need a CLAUDE.md entry "for backup."
Duplication just creates two things to keep in sync.

## Routing Decision Tree

For each thing you'd want future sessions to know, pick the single
best home:

### Decisions — "we chose X over Y because Z"

Architectural choices, tradeoff resolutions, accepted gaps, rejected
alternatives.

**Primary home:** built-in memory via `/cc-remember` (or
`scripts/write-memory-file.mjs` programmatically). One `.md` file per
decision, descriptive slug, indexed in MEMORY.md.

```bash
node scripts/write-memory-file.mjs \
  --slug "decided_<short_name>" \
  --description "<one-line summary>" \
  "We chose X over Y because Z. Tradeoffs considered: ..."
```

**Also add to CLAUDE.md** only if the decision is load-bearing enough
that *every* session needs to know it at startup (not just sessions
that touch the relevant code). Examples: "auth is per-user via FastAPI
Users (no shared passwords)" is load-bearing. "We rejected a specific
library option after evaluation" is not — memory is enough.

### Project constraints / conventions / gotchas

Environmental quirks, dev-workflow requirements, "this project has a
weird setup" facts.

**Primary home:** inline in `CLAUDE.md` or the project briefing. These
files get edited when the code changes — the forcing function is that
they're load-bearing for every session, so staleness surfaces fast.

Use a built-in memory file (`constraint_<short_name>.md` via
`/cc-remember`) only for nuanced constraints where the explanation is
too long for CLAUDE.md. Project-specific quick constraints belong
inline.

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

**Split it.** Route the project piece to its home
(`/cc-remember` / CLAUDE.md / trigger). Route the CC piece to the
upstream-feedback phase (step 11) where it will be drafted and
delivered. Don't bury the upstream piece inside a project decision
doc — it will never find its way home.

### Lessons, gotchas, discoveries (not decisions, not constraints)

"We learned that X behaves differently from docs." "This pattern
works." "The CI was green but prod failed because…"

**Primary home:** built-in memory via `/cc-remember --slug
"lesson_<short_name>" ...`. One `.md` file per lesson.

### User preferences

Style choices, workflow preferences, corrections the user made.

**Primary home:** built-in memory via `/cc-remember --slug
"user_prefers_<thing>" ...`. Or CLAUDE.md if it's a preference that
should fire on every session start (e.g., "always use pnpm").

## Lessons-Applied-to-Own-Output Scan

**Before sending this debrief report**, scan the lessons you just
captured *this session* against the report you're about to write.
Does the report itself violate what was learned?

Concrete example: this session captured a `lesson_dont_trust_estimates`
memory ("user's time estimates are overcalibrated, recalibrate
downward"). The debrief report then includes "this took 30 minutes"
phrasing — directly contradicting the just-captured lesson.

For each captured lesson, ask: *Is the debrief report observing this
lesson?* If not, rewrite the report before sending. Captured but
not applied is the same failure mode that bit us with omega; the
write path doesn't matter, the read-and-apply step does.

## The Anti-Pattern: Loose Project-Scoped .md Files Outside the Memory Dir

**Do not write `feedback-project-*.md`, `decision-*.md`, or similar
loose .md files next to code or in arbitrary project subdirectories.**
This pattern rots — in one audited case, 4 of 5 such files went stale
within 7 days because the underlying code changed and the files had
no forcing function to catch it.

If you are tempted to write a loose .md file:
- Is it a decision? → `/cc-remember --slug "decided_..."`
- Is it a constraint everyone needs? → CLAUDE.md / briefing
- Is it a conditional revisit? → pib-db deferred trigger
- Is it CC upstream friction? → upstream-feedback phase
- None of the above? → it probably doesn't need recording at all

## Before Writing — Contradiction Check

For each memory you're about to capture, search the memory dir for
existing entries on the same topic:

```bash
grep -i "<topic>" ~/.claude/projects/<slug>/memory/*.md
```

If an existing entry contradicts or is superseded by the new one,
edit the old file with a `**Superseded by <new-slug>.md on <date>**`
header. Keep the old file for history — don't delete unless the old
entry was wrong (rather than just outdated).

This is the forcing function that turns memory into a living record
instead of another pile of rotting notes.

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
- 1 decision → memory: decided_jwt_revocation.md
- 1 constraint → article-rewriter/CLAUDE.md (tsc must run from frontend)
- 1 deferred trigger → pib-db act:xxxxxxxx (add blocklist if multi-user)
- 1 upstream piece → CC feedback outbox (cabinet-qa testability)
```

This is also how you catch routing errors: if everything ended up in
memory files, the routing discipline didn't actually run.
