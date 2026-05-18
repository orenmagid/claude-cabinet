---
type: field-feedback
source: claude-cabinet (dogfood)
date: 2026-05-18
component: CLAUDE.md / .claude/rules/* / debrief & cc-publish workflow guidance
---

## "CC-managed file" terminology is ambiguous and causes wrong risk assessments

**Friction:** During the v0.26.0 consumer-update flow today, I described
article-rewriter's uncommitted `CLAUDE.md`, `system-status.md`, and
`.claude/skills/cabinet-system-advocate/feature-ledger.md` edits as
"CC-managed files with risky dirty state for the chore-update commit."
The user pushed back: "I thought CC-managed files can't be edited."

The user was correct. None of those three files are write-guarded by
`template-source-guard`. The hook specifically protects only
manifest-tracked **upstream-owned** files (SKILL.md files for upstream
skills, instruction phases, upstream cabinet members). The other two
categories that live inside `.claude/` are:

- **Customization slots** — `feature-ledger.md`, project phase overlays,
  `directives-project.yaml`, `committees-project.yaml`. The installer
  preserves these on every run (per the "Preserved customized phase"
  log line). Project-owned.
- **Project state** — `CLAUDE.md`, `system-status.md`, briefings,
  `.claude/plans/`, `.claude/verification/`, `pib.db`. Never touched
  by the installer. Pure project-owned.

I called all three "CC-managed" because they live under `.claude/`,
which made me describe a risk that doesn't exist. The user's confusion
was warranted — the term is ambiguous, and CC's own docs don't draw
the line clearly.

**Suggestion:** Document the three-row categorization explicitly in
one (and only one) load-bearing place. Two options:

1. **CLAUDE.md "File categorization" section** in the CC source repo.
   ~15 lines. Format like a table:
   ```
   | Category | Examples | Write-guarded? | Installer overwrites? |
   ```
   Then reference this section from:
   - cc-publish SKILL.md (step 3 staging instructions)
   - debrief workflow (close-work and persist-work guidance)
   - The dirty-state risk discussions any consumer-update flow may have

2. **`.claude/rules/file-categories.md`** dedicated rules file. Same
   content as option 1 but lives in the scoped-prompt layer per the
   enforcement-pipeline.md "rules file" tier.

I lean (1) — putting it in CLAUDE.md gives it sessions-wide reach without
needing a scoped path-pattern match. The row-1/2/3 categorization is
load-bearing for any session that touches consumer-update or installer-
related work.

The omega memory stored today (file-categorization constraint) is a
fallback — it surfaces in queries but isn't load-bearing for every
session. The docs entry is the forcing function.

**Session context:** Post-publish consumer-update workflow for v0.26.0
across flow, article-rewriter, theater-cheater. The commit-staging step
("only stage files the installer actually rewrote") works perfectly via
the snapshot-before / snapshot-after / comm -23 pattern — but the
mental-model framing that motivates it is what I muddled in conversation.
