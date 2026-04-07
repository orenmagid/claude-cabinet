---
name: cabinet
description: |
  List your cabinet members and invoke one by name. Shows who's available,
  what they specialize in, and lets you call on a specific expert.
  Use when: "cabinet", "who's on the cabinet", "ask the architect",
  "what experts do I have", "/cabinet", "get me the [member]".
---

# /cabinet — Your Expert Cabinet

## Purpose

Show who's in your cabinet and let you consult a specific member. The
cabinet is your team of domain experts — each one evaluates from a
different lens. This skill is the front door.

## Workflow

1. **Discover members:** Glob for `.claude/skills/cabinet-*/SKILL.md`.

2. **Read each member's frontmatter:** Extract `name` and the first
   sentence of `description` (before "Use when:"). Strip the `cabinet-`
   prefix for display — the architect is "architect", not
   "cabinet-architecture".

3. **Present the roster:**

   ### Your Cabinet
   | Member | Expertise |
   |--------|-----------|
   | architect | System fit and infrastructure leverage |
   | debugger | Dependency chains, error modes, environment prereqs |
   | ... | ... |

   Sort alphabetically.

4. **If the user named a specific member** (e.g., "ask the architect",
   "/cabinet architect", "get me the historian"), skip the roster and
   invoke that member's skill directly.

5. **If showing the roster**, ask: "Who do you want to consult?"
   When they pick one, invoke that member's skill.

## Important

- Roster is always discovered dynamically — never hardcoded.
- Member names are friendly (no `cabinet-` prefix in display).
- If the user asks for a member that doesn't exist, show the roster
  and say which name didn't match.
