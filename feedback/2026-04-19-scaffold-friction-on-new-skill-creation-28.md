**Friction:** Running `/scaffold skill <name>` surfaces several gaps.
(1) The workflow says "Create directory and SKILL.md from the template" referencing `_template/SKILL.md`, but no such file exists — dead reference.
(2) Frontmatter schema is underspecified: `name`, `description`, `last-verified` are named but the `related:` block, multiline description conventions, and other fields are not documented.
(3) No pattern documented for skills with supporting assets (templates, helper scripts, docs) — the skill assumes a skill is just SKILL.md, but many aren't.
(4) Skill coverage in the workflow (~15 lines) is dwarfed by thread coverage (~80 lines) despite both being first-class.
(5) The relationship to `_index.json` isn't documented — empirically new skills auto-discover, but that isn't stated.
(6) No skill-specific validator (threads have `validate-threads.sh`; skills get a generic `/validate`).

**Suggestion:**
- Create the referenced `_template/SKILL.md` (highest impact — broken today)
- Expand skill-scaffolding section to parity with the thread section
- Document the "skill with supporting assets" pattern (where assets live in the skill folder, how SKILL.md references them, validation expectations)
- Document the `_index.json` auto-discovery flow
- Add skill-specific structural validation (frontmatter schema, description length, required fields)

**Session context:** Built two new skills (/present and /build-presentation) for a Reveal.js presentation pipeline. /build-presentation has 4 supporting assets (template.html, archetypes.md, render.py, launcher.command) and the scaffold workflow had no guidance for that multi-asset case.