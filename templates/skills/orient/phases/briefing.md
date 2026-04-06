# Briefing — How to Present the Orientation

Define how to present the results of orientation to the user. This is
the presentation phase — it can be skipped in quick mode without losing
any system maintenance value.

When this file is absent or empty, the default behavior is: present a
simple summary of project state, work items, and any health issues.
To explicitly skip the briefing, write only `skip: true`.

## What to Include

- **Format** — how to structure the briefing (sections, order, grouping)
- **Tone** — how to communicate (practical, warm, terse, etc.)
- **Modes** — if your project uses different presentation modes (e.g.,
  morning vs. standard, verbose vs. compact), define them here
- **Suggestions** — contextual recommendations based on gathered data

## Example Briefing Formats

Uncomment and adapt these for your project:

<!--
### Standard Briefing

Present in this order:
1. **Items needing attention** — overdue, flagged, or blocked work
2. **Inbox** — counts of unprocessed items
3. **Recent activity** — what changed since last session
4. **Suggested focus** — 1-3 items grounded in data, not generic

Tone: direct, practical. Lead with what matters most.
Close with: "What are we working on?"

### Compact Briefing (quick mode fallback)

One line per category, counts only:
```
Overdue: 2 | Due today: 1 | Inbox: 5 | Health: OK
```
No suggestions, no narrative. Just the numbers.

### Time-Aware Modes

If the session time matters for your project:
- **Morning** (first session of day): include calendar, completions
  since yesterday, day-ahead view
- **Evening** (after 5pm): include tomorrow preview, prep needed
- **Standard** (all other): focus on work surface and system state

Track which mode ran today with a datestamp file to avoid repeating
the extended briefing on subsequent sessions.
-->
