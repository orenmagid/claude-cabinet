# Claude Cabinet — Project Instructions

Node CLI package (`create-claude-cabinet`) that scaffolds process infrastructure
for Claude Code projects. Small codebase: 7 files in `lib/`, templates in
`templates/`. Two dependencies (`prompts`, `better-sqlite3`). No build step.

## Key Files

- `lib/cli.js` — main orchestration, module definitions, all CLI logic
- `lib/copy.js` — template copying with conflict detection
- `lib/omega-setup.js` — Python discovery, venv creation, omega-memory install
- `templates/skills/` — skill definitions (SKILL.md) and phase files
- `templates/skills/onboard/` — conversational onboarding skill
- `templates/skills/cabinet-*/` — 28 expert cabinet member definitions
- `templates/cabinet/` — cabinet infrastructure (committees, lifecycle, etc.)
- `templates/briefing/` — project briefing templates
- `.ccrc.json` — installation metadata and manifest (generated, gitignored)

## Conventions

- Skills use the skeleton/phase pattern: SKILL.md defines orchestration,
  phase files customize behavior. Phase files are absent (use default),
  contain content (override), or contain `skip: true` (disable).
- Templates in `templates/` are the upstream source of truth. Installed
  copies in `.claude/skills/` are downstream (gitignored for this project).
- Module definitions live in the `MODULES` object in `lib/cli.js`.

## Claude Should Always

- Test CLI changes with `--dry-run` before running for real
- Check that `node -c lib/cli.js` passes after editing CLI code
- Preserve the skeleton/phase separation — never hardcode project-specific
  logic into SKILL.md files
- Write interview questions one at a time, never batched

## Dogfooding

When installing CC on itself (the source repo), always use:
```bash
node bin/create-claude-cabinet.js --yes
```
Never use `npx create-claude-cabinet` from inside the source directory —
npx resolves the local package.json instead of fetching from npm,
which can install stale cached versions.

## Claude Should Never

- Add dependencies without discussing it first — the minimal-dependency
  footprint is intentional
- Modify installed `.claude/skills/` files directly — edit the templates
  in `templates/` instead (installed copies are downstream)
- Generate phase files with placeholder content — absent is better than
  generic
