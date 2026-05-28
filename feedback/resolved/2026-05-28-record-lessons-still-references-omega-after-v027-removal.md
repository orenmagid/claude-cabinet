---
type: field-feedback
source: article-rewriter
date: 2026-05-28
component: debrief/phases/record-lessons.md
status: resolved
resolution: instruction-phase overwrite fix (commit bbd2d94) — phases explicitly listed in MODULES now bypass the phase-file guard
---

## record-lessons.md still references omega after v0.27 removal

**Friction:** `record-lessons.md` (manifest hash `9034ab01404299c3`) instructs `/debrief` to pipe decisions through `~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py store` and names omega as the "Primary home" for decisions and constraints. After a completed omega→built-in migration (v0.27+), this adapter no longer exists on disk — the inert-artifact sweep deletes it, and the venv is deactivated. A post-migration `/debrief` session would follow these instructions and fail silently or error.

**Root cause:** The upstream template was updated but the phase-file guard in both cli.js (single-file path) and copy.js (directory-walk path) preserved the stale consumer copy, treating it as "customized." Instruction phases are CC-owned and should always overwrite.

**Fix:** Instruction phases explicitly listed in MODULES templates arrays now bypass the guard. Customization phases remain preserved.

**Session context:** Hit during `/cc-upgrade` inert-artifact sweep in article-rewriter — removed the four dead omega files and then grep'd for remaining references, finding this manifest-tracked file still pointing at the deleted script.
