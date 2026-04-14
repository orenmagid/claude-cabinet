---
type: field-feedback
source: theater-cheater
date: 2026-04-13
component: memory system / feedback recall
---

## Feedback memories loaded at orient but not applied during relevant work

**Friction:** A feedback memory explicitly says "never guess in browser automation — always observe the actual page first." This was loaded and displayed during orient. Minutes later, Claude guessed about calendar behavior ("furthestExisting = furthest date that exists on the calendar") without reasoning about what the calendar actually is. User had to correct: "ALL DATES EXIST ON THE CALENDAR." The memory was surfaced but didn't prevent the exact behavior it describes.

**Suggestion:** High-severity feedback memories could be re-surfaced at the moment of relevant tool use — e.g., before editing browser automation files, surface the "no guessing" memory again. Alternatively, feedback memories with enforcement type 'prevent' could become pre-edit hooks that inject a reminder. Loading at orient and hoping for session-long compliance is ~60-80% at best.

**Session context:** Fixing probe rollover detection logic in browser automation code.
