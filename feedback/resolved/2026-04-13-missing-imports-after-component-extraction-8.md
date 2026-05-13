> **NOTE (moved to outbox 2026-04-17):** This feedback was originally
> written to `.claude/memory/feedback/` in article-rewriter — a
> location the current orient skill flags as a wrong-write for CC
> upstream feedback. It was authored 2026-04-12 or 2026-04-13 (see
> frontmatter `date` below) but never delivered upstream because
> the assistant at that time could not invoke `/cc-feedback`. It's
> being moved to the global outbox now so CC can pick it up. **It may
> already have been addressed** in the 4–5 days since it was written;
> CC should verify current state before acting.

---

---
type: feedback
date: 2026-04-13
skills:
  - execute
  - cabinet-qa
severity: moderate
---

# Missing imports after component extraction

## What Happened

During Phase A, we extracted components and hooks from a 344-line
monolithic RewritePage.tsx. After extraction, the slimmed-down
RewritePage still used `<Paper>` in its error display JSX, but the
Paper import was no longer present — it had been removed along with
other imports that moved to the extracted components. The build broke
with a clear error, but it should have been caught before attempting
the build.

## Root Cause

Component extraction is a mechanical refactoring, but the import
cleanup step was done by intuition rather than verification. When you
remove large blocks of JSX, it's easy to miss that a remaining line
still depends on an import that looks like it "belongs" to the
extracted code.

## Suggested Fixes

1. **For execute skill:** After any component extraction, run
   `tsc --noEmit` (or the project's type-check command) immediately —
   before writing any other code. Make this a mandatory step in the
   extraction workflow, not something that happens at the end of the
   phase.

2. **For cabinet-qa:** When reviewing extraction PRs, specifically
   check that every JSX element and hook call in the reduced parent
   file has a corresponding import. This is a known class of
   extraction bug.

3. **Pattern:** The general rule is "after removing code, verify what
   remains still compiles" — but the specific version for React
   extractions is "check imports in both the new component AND the
   reduced parent."
