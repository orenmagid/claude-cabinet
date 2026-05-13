# Feedback Remediation v4 — Address 16 Field Feedback Items

## Problem

16 field feedback reports have accumulated in `feedback/` from 4 consuming
projects (CC self, article-rewriter, Flow, theater-cheater/SIC). These
represent real friction discovered through use. The feedback spans worktree
safety, hook failures, skill behavior gaps, and lifecycle bugs. Without
remediation, the same friction recurs in every session.

## Approach

Group the 16 items into 10 actions by theme. Three enforcement tiers:
- **Structural** (scripts/code): 4 actions — mechanical fixes, testable
- **Skill prose** (templates): 5 actions — SKILL.md improvements
- **Integration** (omega setup): 1 action — MCP server registration

Items that can't be fixed upstream (Claude Code platform behavior, system
prompt conflicts) get documented as known limitations with workarounds.

## Implementation

### Phase A: Structural Fixes (scripts/code)

**A.1: Fix omega-memory-guard glob pattern**
- File: `templates/hooks/omega-memory-guard.sh`
- Bug: `case` pattern `*.claude/memory/*` doesn't match absolute paths
  because shell `*` doesn't cross `/` boundaries
- Fix: Change case pattern to use explicit substring checks:
  ```bash
  case "$FILE_PATH" in
    */\.claude/memory/*|*/\.claude/projects/*/memory/*)
  ```
  Or switch to `[[ "$FILE_PATH" == *".claude/memory/"* ]]` with a
  separate check for `*/projects/*/memory/*`
- Test: `echo '{"file_path":"/Users/x/.claude/projects/y/memory/test.md"}' | CLAUDE_TOOL_INPUT=/dev/stdin bash templates/hooks/omega-memory-guard.sh`
- Resolves: sic-2026-04-14-pretooluse-hook-failed-to-block-flat-memory-write

**A.2: Fix validator regex + validate fallback**
- File: `scripts/skill-validator.sh` line ~234
- Bug 1: `description-when` regex requires trigger word immediately after
  activation verb. "Activates throughout sessions when X" fails.
- Fix 1: Loosen regex to allow 0-4 words between verb and trigger:
  `Activate(s|d)?\s+(\S+\s+){0,4}(when|during)`
- File: `templates/skills/validate/SKILL.md`
- Bug 2: Without `phases/validators.md`, /validate reports "no validators"
  and exits. The installer skips phase files by design.
- Fix 2: Add default behavior to validate skeleton — if validators.md is
  absent, scan for `scripts/*-validator.sh` and run any found. This
  follows the same "absent = default behavior" pattern as other skeletons.
- Test: Run `/validate` after fix — should find and run skill-validator.sh
- Resolves: claude-cabinet-2026-04-15-validator-when-regex-too-strict,
  claude-cabinet-2026-04-15-validate-fails-silently-no-validators-md

**A.3: Fix pib-db MCP worktree resolution**
- File: `templates/scripts/pib-db-lib.mjs` (or wherever the MCP server
  opens pib.db)
- Bug: Opens `pib.db` relative to cwd. In worktrees, finds empty stub.
- Fix: Walk up directory tree to find a non-empty `pib.db`, or check for
  `.git` file (worktree indicator) and resolve to the main worktree's db.
  Pattern: `git rev-parse --show-toplevel` → if `.git` is a file (not dir),
  read it for the real repo path → use that path's pib.db.
- Test: From a worktree, query pib-db and verify it returns real data.
- Resolves: sic-2026-04-15-pib-db-mcp-resolves-to-worktree-local-stub

**A.4: Fix cc-publish Step 6 staging**
- File: `templates/skills/cc-publish/SKILL.md`
- Bug 1: Step 6.3 `git add` bundles pre-staged project files into CC
  update commit.
- Fix 1: Add `git -C <path> reset HEAD -- .` before staging CC files.
  Updated step 3:
  ```
  3. After a successful update, commit ONLY CC-managed files:
     - First: `git -C <path> reset HEAD -- .` (clear any pre-staged files)
     - Then: `git -C <path> add .claude/ .mcp.json scripts/pib-db*.mjs ...`
     - Commit with message: `chore: update claude-cabinet to v<version>`
  ```
- Bug 2: Step 6 didn't auto-execute after npm publish.
- Fix 2: Add explicit continuation gate after Step 5:
  ```
  **DO NOT stop here.** Step 6 is mandatory — the publish is incomplete
  until all local consumers are updated. Proceed to Step 6 immediately.
  ```
- Resolves: claude-cabinet-2026-04-14-publish-consumer-dirty-staging,
  claude-cabinet-2026-04-15-cc-publish-step-6-not-executed

### Phase B: Skill Prose Improvements (templates)

**B.1: Add worktree safety to orient + debrief**
- File: `templates/skills/orient/SKILL.md` (Health Checks section)
- Add default health check: scan for branches with commits ahead of
  main/trunk. `git for-each-ref --format='%(refname:short)' refs/heads/`
  cross-referenced with `git log --oneline main..<branch>`. Surface as
  advisory: "Branch X has N commits ahead of main."
- Also check `git worktree list` for worktrees whose branch has diverged.
- File: `templates/skills/debrief/SKILL.md` (or appropriate phase)
- Add pre-exit check: if `git log --oneline $(git rev-parse --abbrev-ref
  @{upstream} 2>/dev/null || echo main)..HEAD` is non-empty, enumerate
  unmerged commits and ask: merge, keep, or discard?
- Known limitation: worktree-branching-from-remote is a Claude Code
  platform behavior (Agent tool `isolation: "worktree"` branches from
  remote tracking ref, not local HEAD). Document as known constraint
  with workaround: "push before spawning worktree agents."
- Resolves: sic-2026-04-15-orphan-worktree-branch-hazard,
  claude-cabinet-2026-04-11-worktree-branches-from-remote

**B.2: Improve orient context defaults**
- File: `templates/skills/orient/SKILL.md` (context phase default)
- Add deployment detection to default context loading: check for
  `railway.toml`, `Dockerfile`, `.github/workflows/`, `fly.toml`,
  `vercel.json`, `netlify.toml`. If found, surface the deploy method
  in the briefing under a "Deployment" heading.
- Add guidance about phase file separation: when phase files combine
  data-gathering and data-acting steps, the model may treat the query
  as satisfying the processing. Add a note in the Phase File Protocol:
  "Phases that both gather and act on data should use clear structural
  separation (numbered steps, explicit 'Now act on the results above:'
  transitions). The model tends to treat data-gathering as completion."
- Resolves: theater-cheater-2026-04-13-orient-doesnt-surface-deployment-method,
  flow-2026-04-11-orient-phase-files-mix-data-gathering-and-data-acting

**B.3: Improve execute skill robustness**
- File: `templates/skills/execute/SKILL.md`
- Add post-extraction verification step: after any component extraction
  or file split, immediately run the project's type checker (`tsc --noEmit`,
  `mypy`, `pyright`, etc.) to catch missing imports before proceeding.
- Add UI framework verification mandate: before using unfamiliar component
  props, read the `.d.ts` file from `node_modules/<package>/` or run
  the type checker. Never guess prop names from memory of prior versions.
- Resolves: article-rewriter-2026-04-13-execute-missing-imports-after-extraction,
  article-rewriter-2026-04-13-ui-framework-prop-guessing

**B.4: Fix debrief feedback resolution**
- File: `templates/skills/debrief/phases/close-work.md`
- The resolution logic already exists (lines 94-119). The issue is that
  debrief didn't execute it when a project explicitly addressed feedback.
- Fix: Strengthen the trigger. Currently the check cross-references git
  log against feedback files. Add: when a closed project's name or
  description contains "feedback" or "remediation", explicitly scan all
  feedback files and present them for resolution — don't rely on git-log
  matching alone.
- Resolves: claude-cabinet-2026-04-14-debrief-missed-feedback-resolution

**B.5: Fix cc-feedback delivery routing**
- File: `templates/skills/cc-feedback/SKILL.md`
- Bug: The "linked" case writes directly to CC repo's `feedback/`,
  dirtying the source repo working tree from consuming projects.
- Fix: Remove the "linked" direct-write path. Only two delivery modes:
  1. Dogfood (IS the CC source repo) → write to local `feedback/`
  2. Everything else → write to `~/.claude/cc-feedback-outbox.json`
     (orient in the CC repo picks these up next session)
- The outbox-to-delivery pipeline already works (proven this session).
- Resolves: sic-2026-04-14-cc-feedback-skill-delivery-logic-writes-directly

### Phase C: Integration Fix

**C.1: Register omega MCP server**
- File: `lib/omega-setup.js`
- Bug: Omega hooks fire correctly but no MCP tools are available because
  `mcpServers` in settings.json is empty. The assistant can't query or
  store to omega directly.
- Fix: After installing omega hooks, also register the omega MCP server
  in `~/.claude/settings.json` under `mcpServers`. Omega supports stdio
  mode via `omega proxy`. Add:
  ```json
  "mcpServers": {
    "omega": {
      "command": "<venv>/bin/omega",
      "args": ["proxy"],
      "env": {}
    }
  }
  ```
  Verify the proxy command works first. If omega doesn't support stdio
  proxy directly, use the serve daemon approach instead.
- Also document the auto-memory system prompt conflict: when omega is
  active, Claude Code's built-in auto-memory instructions in the system
  prompt describe a file-based `.md` system that conflicts with omega.
  Add a note in `templates/rules/memory-capture.md` explaining this is
  a known platform limitation — the rules file and CLAUDE.md omega
  instructions should override, but may not always win.
- Resolves: sic-2026-04-14-omega-mcp-tools-not-available,
  theater-cheater-2026-04-13-auto-memory-system-prompt-conflicts-with-omega

## Surface Area

- files: templates/hooks/omega-memory-guard.sh
- files: scripts/skill-validator.sh
- files: templates/skills/validate/SKILL.md
- files: templates/scripts/pib-db-lib.mjs
- files: templates/skills/cc-publish/SKILL.md
- files: templates/skills/orient/SKILL.md
- files: templates/skills/execute/SKILL.md
- files: templates/skills/debrief/SKILL.md
- files: templates/skills/debrief/phases/close-work.md
- files: templates/skills/cc-feedback/SKILL.md
- files: lib/omega-setup.js
- files: templates/rules/memory-capture.md
- files: lib/settings-merge.js

## Acceptance Criteria

- [auto] `bash scripts/skill-validator.sh templates/skills/cabinet-interactive-storyteller/SKILL.md` passes (regex fix — this member has "Activates throughout" phrasing)
- [auto] omega-memory-guard blocks writes to absolute paths like `/Users/x/.claude/projects/y/memory/test.md`
- [auto] `/validate` discovers and runs `scripts/skill-validator.sh` without a `phases/validators.md` file present
- [auto] `node -c lib/omega-setup.js` passes after MCP server registration changes
- [auto] `node -c lib/cli.js` passes
- [manual] From a worktree, pib-db MCP tools return data from the canonical database
- [manual] `/orient` surfaces branches with unmerged commits
- [manual] `/debrief` checks for unmerged commits before exit
- [manual] `/orient` detects and surfaces deployment method when `railway.toml` or equivalent exists
- [manual] cc-publish Step 6 includes staging reset and doesn't stop after npm publish
- [manual] cc-feedback from a linked consumer writes to outbox, not directly to CC repo
- [deferred] Execute skill catches missing imports after component extraction (next article-rewriter session)
- [deferred] Execute skill mandates .d.ts verification before unfamiliar props (next UI session)

## Enforcement Analysis

| Action | Layer | Notes |
|--------|-------|-------|
| A.1 omega-memory-guard | Structural (hook script) | Deterministic fix |
| A.2 validator fixes | Structural (script) + Skill prose | Regex is structural; fallback is prose |
| A.3 pib-db worktree | Structural (code) | Deterministic fix |
| A.4 cc-publish staging | Skill prose | Could be a hook but staging reset is context-dependent |
| B.1 worktree safety | Skill prose | Orient check is advisory; debrief check could be a hook |
| B.2 orient context | Skill prose | Deployment detection is heuristic |
| B.3 execute robustness | Skill prose | Could be a hook (post-extraction type check) |
| B.4 debrief feedback | Skill prose | Cross-reference logic is heuristic |
| B.5 cc-feedback routing | Skill prose | Delivery logic is deterministic — promotion candidate |
| C.1 omega MCP | Structural (code) | Deterministic setup change |

**Promotion candidates:** B.1 debrief unmerged-commits check and B.5
cc-feedback routing are deterministic enough for hook promotion in a
future iteration.
