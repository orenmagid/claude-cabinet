---
type: field-feedback
source: deify
date: 2026-04-20
component: cabinet-record-keeper
---

## Summary

Cabinet-record-keeper directive currently says: "Two jobs: (1) Staleness — check if any CLAUDE.md, README, system-status, briefing, or memory files now contain claims that became wrong. (2) Additions — check if this session built, changed, or published anything that should be recorded in those files but isn't yet (new capabilities, version bumps, count changes, new conventions). Fix what you find — don't create findings."

Observed friction: when synthesizing the additions, the agent extrapolated from session intent rather than reading the actual code, and confidently wrote three false claims into webapp/backend/CLAUDE.md and system-status.md during one debrief:

1. "HTTPSRedirectMiddleware must skip the healthcheck path. Path filter applied in main.py." — Reality: the middleware was DROPPED entirely. There is no path filter. The fact that the bug existed and was fixed is correctly captured; the fix mechanism is wrong.

2. "fidelity_issue_count must coerce None → 0 before the DB write. SQLite NOT NULL rejected the raw critic output. Fixed at the writer in run_capture.py." — Reality: the column is nullable INTEGER, the value is intentionally distinct between null (critic didn't run) and 0 (ran cleanly). The bug was that complete_run() in routers/rewrite.py wasn't being passed the value at all. Fix was in claude.py + rewrite.py, not run_capture.py.

3. "framework_public.py resolves the framework directory relative to the repo root, not CWD." — Reality: the bug was that the file LIVED at webapp/backend/data/framework_public.py and got hidden by the volume mount at /app/data. Fix was a `git mv` of the file plus a one-line import update. No path resolution change.

Pattern: the agent appears to be reasoning from "there was a bug, plausible fix would be X" rather than reading the actual diff or current state of the named file. The intent ("capture what changed") was right; the executed claims were fabricated.

## Suggestion

Add to the directive an explicit verification step: "Before writing any claim about a fix mechanism into CLAUDE.md or status docs, grep the named file/symbol in the working tree to confirm the claim matches reality. If the working tree doesn't show what you're about to write, downgrade the claim to 'fixed during this session — see commit <sha>' instead of asserting the mechanism." Also consider: when summarizing bugs hit + fixed, the agent should READ the relevant commit diffs (git log + git show) before writing the summary, not infer from session conversation memory.

## Session context

Railway first-deploy session for de[sic]ify (act:8d31b811). Five backend bugs fixed in-flight; record-keeper agent invoked during /debrief to update docs; three of the five bug summaries it wrote were factually wrong against the actual post-fix code. The user (Oren) caught the issue when the operator (Claude) spot-checked the agent's output before committing — but a less paranoid review would have committed the false claims as-is.
