# pib-db MCP resolves to worktree-local stub, not canonical main-repo db

**Source:** sic  
**Date:** 2026-04-15  
**Component:** mcp/pib-db

The pib-db MCP server opens a pib.db relative to the current working directory. For a git worktree under .claude/worktrees/<name>/, this resolves to a 4KB empty stub distinct from the main repo's 516KB canonical pib.db. Throughout an entire /plan-heavy session, every mcp__pib-db__pib_* tool call returned empty/not-found for fids that demonstrably exist in the canonical db. The assistant fell back to direct `sqlite3 /Users/orenmagid/article-rewriter/pib.db` for every query, update, and insert (7 touched actions, ~70K chars of notes updates).

Evidence:
- `ls -la pib.db /Users/orenmagid/article-rewriter/pib.db` shows 4KB worktree stub vs 516KB canonical.
- `mcp__pib-db__pib_query "SELECT fid FROM actions WHERE fid = 'act:anninlin'"` returns {"rows": []} even when the action exists in the main db.
- Every pib_get_action call returned "No action found with fid: <fid>" for real fids.

Expected: worktree sessions should resolve the canonical db. /orient's work-scan defaults to pib_query and silently reports 0 projects / 0 actions from a worktree, giving a completely wrong picture until someone notices the db file size mismatch.

Suggested fix directions (not prescriptive):
1. MCP server walks up from cwd to find a non-empty pib.db (mirrors how git finds .git).
2. Project-level config (e.g. .pibrc, package.json field) points at the canonical db path; MCP server reads it.
3. Worktree setup documents a symlink (fragile due to SQLite WAL files, probably not the right fix but worth noting).

Session context: [sic] article-rewriter. Used /orient and /plan extensively in a worktree; both would have benefited from correct MCP db resolution.
