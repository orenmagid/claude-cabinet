---
type: field-feedback
source: claude-cabinet
date: 2026-04-08
component: skills/orient (skeleton default)
---

## Orient briefing varies session to session

**Friction:** Without a `phases/briefing.md`, the orient skeleton's default
briefing is freeform. Each session presents information in a different order
with different emphasis. In one session, consuming projects are prominent;
in the next, they're buried under "Health." The user expected consistent
sections and was surprised when consuming project info disappeared.

**Suggestion:** Either make the default briefing more structured (define
required sections in the skeleton itself), or document clearly in the
skeleton that consistent output requires a `phases/briefing.md` with
explicit section definitions. The skeleton currently says "present a
simple summary" which gives too much latitude.

**Session context:** Running /orient on the CC source repo, noticing that
consumer project info (Flow, multiShopper) was mentioned differently than
in prior sessions.
