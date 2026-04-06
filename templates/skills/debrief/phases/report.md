# Report — How to Present the Debrief Summary

Define how to present the debrief results to the user. This is the
presentation phase — it can be skipped in quick mode without losing
any operational value (all core phases still run).

When this file is absent or empty, the default behavior is: present a
brief summary of work closed, state updated, and lessons recorded. To
explicitly skip the report, write only `skip: true`.

## What to Include

- **Format** — what sections to include in the report
- **Tone** — how to communicate results
- **Modes** — if your project uses different presentation modes (e.g.,
  evening preview, verbose vs. compact)
- **What NOT to include** — execution guides, instructions for next
  session (the work items ARE the handoff)

## Example Report Formats

Uncomment and adapt these for your project:

<!--
### Standard Report

Present in this order:
1. **Work closed** — items marked complete (with references)
2. **Feedback resolved** — comments or feedback addressed
3. **State updated** — files and docs that were updated
4. **Lessons recorded** — memories created or updated
5. **Loose ends captured** — non-project items routed
6. **Anything needing input** — keep this minimal

Tone: brief, factual. The user can read the diffs.

Do NOT produce "how to start next session" guides. The work items
have the full specs. If the items' notes are insufficient, update them
— don't compensate in chat output that vanishes with the session.

### Compact Report (quick mode fallback)

Bullet list, one line per category:
- Actions completed: [list with fids]
- Feedback resolved: [count]
- Lessons: [files updated]

No narrative, no suggestions.

### Evening Preview

If the session ends in the evening and your project tracks calendar
events or scheduled work, append a brief preview of tomorrow:
- Tomorrow's events
- Items due tomorrow
- Anything needing morning preparation

This is enough to mentally close the session.
-->
