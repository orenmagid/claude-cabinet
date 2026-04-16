# /validate fails silently in dogfood install because phases/validators.md isn't copied

**Source:** claude-cabinet
**Date:** 2026-04-15
**Component:** skills/validate

The installer skips phases/ directories by design (so consuming projects opt into customization via /onboard). But the validate skill REQUIRES phases/validators.md to know what to check — without it, /validate reports 'no validators configured' and exits.

In the CC source repo (dogfood install), this means /validate is broken out of the box after install. Workaround applied this session: manually `cp templates/skills/validate/phases/validators.md .claude/skills/validate/phases/`.

**Suggestions:**
1. Validate's skeleton falls back to running `templates/skills/validate/phases/validators.md` if `.claude/skills/validate/phases/validators.md` doesn't exist
2. Installer copies phase files for skills that need them as a default install (signal via SKILL.md frontmatter like `phases-required: [validators.md]`)
3. Document this as a known dogfood gotcha in `skill-best-practices.md`

Discovered while completing prj:998cc321 — the framework lands but immediately fails the smoke test until the phase file is manually staged.
