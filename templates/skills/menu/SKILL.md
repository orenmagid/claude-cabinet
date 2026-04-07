---
name: menu
description: |
  Show available skills with descriptions and invocability.
  Use when: "menu", "what can you do", "what skills", "help", "/menu".
---

# /menu — Available Skills

## Purpose

Dynamically discover and display all available skills, what they do, and
whether they are auto-invocable or manual-only.

## Workflow

1. **Discover skills:** Use the Glob tool to find all `.claude/skills/*/SKILL.md` files.

2. **Read frontmatter from each:** For every discovered SKILL.md, use the Read tool
   to extract the YAML frontmatter (between the `---` delimiters). Parse these fields:
   - `name` — the skill name (used as `/name` in the table)
   - `description` — first line or sentence of the description (strip the
     "Use when:" portion for display)
   - `disable-model-invocation` — if `true`, the skill is manual-only.
     If absent or false, Claude can invoke it automatically.

3. **Group skills into two categories:**

   **Auto (Claude uses these when relevant)** — skills where
   `disable-model-invocation` is absent or false. These trigger automatically
   when the context matches.

   **Manual (user invokes these — they have side effects)** — skills where
   `disable-model-invocation: true`. The user must explicitly invoke these.

   Note: `/menu` itself goes in whichever category its own frontmatter indicates.

4. **Format as two tables:**

   ### Auto (Claude uses these when relevant)
   | Skill | When it triggers |
   |---|---|
   | `/name` | description (from the "Use when:" part of the description field) |

   ### Manual (you invoke these — they have side effects)
   | Skill | What it does |
   |---|---|

   Sort alphabetically within each group.

5. **Suggest relevant skills:** Based on current context (open work items,
   queued tasks, recent activity), suggest which skills are most relevant
   right now.

## Important

- Do NOT hardcode any skill names or descriptions. Every entry must come
  from reading the actual SKILL.md files at discovery time.
- **Exclude `cabinet-*` skills from the menu.** Individual cabinet members
  are accessed through `/cabinet`, not listed alongside workflow skills.
  The `/cabinet` skill itself DOES appear in the menu.
- If a new skill is added to `.claude/skills/`, it automatically appears
  in the menu on the next invocation. No updates to this file needed.
- If a SKILL.md has no description, show the skill name with "(no description)".
