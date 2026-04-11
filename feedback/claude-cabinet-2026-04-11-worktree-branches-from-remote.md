---
type: field-feedback
source: claude-cabinet
date: 2026-04-11
component: Agent tool (isolation: "worktree")
---

## Worktree agents branch from remote tracking point, not local HEAD

**Friction:** When using `isolation: "worktree"` with the Agent tool,
the worktree branches from the remote tracking point (e.g., origin/main)
rather than the local HEAD. If local main has unpushed commits, the
worktree agent doesn't see them. This caused two agents to generate
diffs that deleted files added in an unpushed commit (cabinet-anthropic-
insider). Had to manually cherry-pick good changes and discard the
regressions both times.

**Suggestion:** Worktree agents should always branch from local HEAD of
the current branch, not the remote tracking ref. Unpushed local commits
are the developer's current state — ignoring them causes data loss.

**Session context:** Running /execute-plans with worktree agents for
Platform Feature Adoption project. Multiple agents regressed by trying
to delete recently-committed-but-unpushed files.
