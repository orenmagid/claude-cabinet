# Orphan-worktree-branch hazard: commits can sit unmerged indefinitely with no surface signal

**Source:** sic
**Date:** 2026-04-15
**Component:** skills/debrief and skills/orient

Concrete near-miss from today (2026-04-15): a session in worktree `gifted-haibt` committed 5578 lines across 22 files (fixture capture/replay infrastructure, dev drawer, committed JSONL fixtures) in two commits (5021099, 1db1078) and ended without merging to main. A new session started today in worktree `jovial-pare` and ran /orient, which gave a complete-looking briefing with zero mention of the orphan branch. The user only discovered the orphan when the assistant tried to read `webapp/backend/services/fixture_replay.py` and it wasn't there — the action notes for the current work (act:strucout) referenced it as if it were part of the codebase. ~4 hours of work almost lost. If `git worktree remove --force gifted-haibt` had been run, reflog would have preserved it for 90 days but nobody would have known to look.

Three gaps:

1. **Debrief doesn't check unmerged commits before exit.** A worktree session can end with `git log main..HEAD` non-empty and nothing asks 'merge now, keep for later, or discard?' This is the primary guardrail that's missing.

2. **Orient doesn't warn about unmerged feature branches.** On session start, if any branch has commits ahead of main (especially one whose worktree still exists or was recently touched per reflog), orient should surface it as an attention item. Currently the work-scan phase lists pib-db work items but never cross-references git state.

3. **Worktree isolation amplifies the risk.** Each worktree sees only its own branch. A new session in worktree B has no visibility into unmerged work from worktree A. No global 'unmerged work' view exists.

Suggested fixes, in order of leverage:

- **Debrief phase addition**: before wrap-up, run `git log --oneline <trunk>..HEAD`. If non-empty, enumerate the unmerged commits and ask: merge to trunk now, keep the branch for later work, or discard (with confirmation)? This is where the guardrail belongs — session end is the natural point to decide where commits go.

- **Orient health check addition**: `git for-each-ref --format='%(refname:short) %(committerdate:iso)' refs/heads/` cross-referenced against `git log <trunk>..<branch>` to find branches with commits ahead of trunk that were committed-to recently. Surface as '⚠ Branch X has N commits ahead of <trunk>, last touched Nh ago — merge, continue, or discard?' Advisory, not blocking.

- **Worktree-aware listing**: `git worktree list` combined with `git log <trunk>..<worktree-branch>` for each entry gives a global view. Could be a dedicated `/unmerged` skill or folded into orient.

The debrief guardrail is the most important — it catches the problem at the moment the decision is being implicitly made (to not merge). Orient is the safety net for when debrief was skipped or the session ended abruptly.

Session context: [sic] article-rewriter, worktree-heavy workflow (every non-trivial change starts with EnterWorktree). Discovered while beginning act:strucout work that referenced files from the orphaned branch.