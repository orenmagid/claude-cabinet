# Options — Structured Decision Points Before Generation

After the interview and before generating briefing files, surface the key
decisions that shape how the project and process layer get set up. Present
options with trade-offs so the user makes informed choices — not Claude
making choices for them.

When this file is absent or empty, the default behavior is: identify
decisions implied by the interview, present options, let the user choose.
To explicitly skip (e.g., the user already has strong opinions from the
interview), write only `skip: true`.

## When This Phase Activates

Not every onboard needs this. Skip it when:
- The user described a clear tech stack and workflow (nothing to decide)
- This is a re-run (decisions were already made)
- The project is already built and this is process-layer-only

Run it when the interview revealed **open decisions** — things the user
hasn't settled yet that will affect what briefing files contain:

- "I'm not sure what database to use"
- "I don't know if I need a backend"
- "What would you recommend?" (redirected here from the interview)
- Greenfield project where the user described *what* but not *how*

## How to Present Options

For each open decision, present 2-3 concrete options with trade-offs.
Use two cabinet members internally (do not spawn agents — just
reason from these viewpoints):

### Architecture Cabinet Member
Evaluates each option for: complexity, maintenance burden, whether it
matches the user's described skill level and project scope. Flags when
an option is overkill for a weekend project or too lightweight for
something ambitious.

### Boundary Man
Evaluates each option for: what breaks first, what's hard to change
later, what locks you in. Flags irreversible decisions that deserve
extra thought.

### Format

```
## [Decision: e.g., "How to store data"]

Based on what you described — [reference specific things from interview] —
here are your options:

**Option A: [name]**
- What it is: [1 sentence]
- Good for: [when this is the right choice]
- Trade-off: [what you give up]

**Option B: [name]**
- What it is: [1 sentence]
- Good for: [when this is the right choice]
- Trade-off: [what you give up]

**Option C: [name]** (if applicable)
- ...

What sounds right for your situation?
```

### Tone

- **Present, don't prescribe.** "Here are your options" not "I recommend X."
- **Reference the interview.** "You mentioned it's just you and this is a
  side project, so..." — ground options in their specific situation.
- **Be honest about complexity.** If one option is simpler but limited,
  say so. If another is powerful but requires more setup, say so.
- **Respect "I don't know."** If the user can't decide, suggest starting
  with the simplest option and note that it can be changed later. Don't
  pressure decisions.

## What This Is NOT

- **Not architecture consulting.** You present options the interview
  surfaced, not a comprehensive technology evaluation. If the user wants
  deep architecture advice, that's a working session topic, not onboard.
- **Not prescriptive.** Never say "you should use X." Always frame as
  options with trade-offs.
- **Not exhaustive.** 2-3 options per decision. Not every possible
  approach.

## Output

The user's choices feed into generate-briefing. Each decision becomes
concrete content in `_briefing.md` (architecture section), CLAUDE.md
(conventions), and potentially orient phase files (what to check).

If the user defers a decision ("I'll figure that out later"), note it
in `_briefing.md` as an open question — don't leave the section empty
without explanation.
