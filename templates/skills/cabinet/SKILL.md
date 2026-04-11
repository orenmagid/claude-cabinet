---
name: cabinet
description: |
  List your cabinet members and invoke one by name. Shows who's available,
  what they specialize in, and lets you call on a specific expert.
  Use when: "cabinet", "who's on the cabinet", "ask the architect",
  "what experts do I have", "/cabinet", "get me the [member]".
argument-hint: "member name — e.g., 'architect', 'security'"
---

# /cabinet — Your Expert Cabinet

## Arguments

If `$ARGUMENTS` is provided and matches a cabinet member name (without
the `cabinet-` prefix), invoke that member directly — skip the roster
display. If $ARGUMENTS doesn't match any member, show the roster and
note which name didn't match.

Empty $ARGUMENTS: Show the full roster and ask who to consult.

## Purpose

Show who's in your cabinet and let you consult a specific member. The
cabinet is your team of domain experts — each one evaluates from a
different lens. This skill is the front door.

## Workflow

1. **Read the skill index:** Read `.claude/skills/_index.json` and filter
   to entries where `type === "cabinet"`. This gives you every cabinet
   member's name and description in one read.

   If the index file doesn't exist (older install), fall back to
   Glob for `.claude/skills/cabinet-*/SKILL.md` and read frontmatter.

2. **Strip the `cabinet-` prefix** for friendly display — the architect
   is "architect", not "cabinet-architecture".

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
