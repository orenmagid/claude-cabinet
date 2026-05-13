---
type: field-feedback
source: article-rewriter (retrospective extraction)
date: 2026-04-20
component: skills/execute (or skills/cabinet-debugger)
---

## /execute should verify tooling location in projects with nested package.json

**Friction:** In article-rewriter (monorepo layout with `webapp/frontend/`
owning typescript), running `npx tsc --noEmit` from the repo root
silently fails because typescript isn't a root dependency. The error
message ("tsc not found") is misleading — it looks like a missing
install rather than a wrong-cwd problem. This cost debugging rounds in
at least one 2026-04-13 session.

**Suggestion:** Teach `/execute` (and/or cabinet-debugger) to, before
running build/lint/typecheck commands, detect multi-package layouts
(presence of nested `package.json` under a `webapp/`, `apps/`,
`packages/`, or similarly structured subdirectory) and check which
directory actually owns the tool binary being invoked. If the tool
exists only in a subdir, prefer `npx --prefix <subdir>` or `cd <subdir>
&&` rather than running from repo root.

General pattern: "root package.json ≠ tooling owner" in any monorepo-
style layout. The heuristic is cheap: `git ls-files "**/package.json"`
+ check each for the target tool.

**Origin:** Extracted from a project-scoped feedback file
(`feedback-project-tsc-must-run-from-frontend.md`) during the
2026-04-20 outbox/feedback audit. The project-specific fix (add to
article-rewriter's CLAUDE.md) has been applied; this report captures
the CC-wide pattern worth teaching `/execute` or cabinet-debugger.
