# Feedback Remediation v2 — Close Structural Gaps Across Plan/Execute/Orient/Feedback Pipeline

## Problem

17 field feedback items from 4 consuming projects (article-rewriter, theater-cheater, flow, CC itself) reveal systemic gaps in CC's core skill pipeline. These aren't isolated bugs — they cluster into patterns where compliance-layer instructions (~60-80% adherence) are doing the work of structural enforcement (~100%). The result: every session re-discovers the same failures.

**Pattern A: Plan/Execute detail loss** (6 items) — Plans write detail to ephemeral files, action notes compress it away, execute builds from titles not specs. The entire plan→execute pipeline leaks detail at every handoff.

**Pattern B: Orient context gaps** (4 items) — Orient doesn't surface deployment context, doesn't enforce omega queries, doesn't check the feedback outbox, and feedback memories loaded at orient don't persist through the session.

**Pattern C: Feedback delivery broken** (3 items) — The outbox has no auto-flush, `/cc-feedback` can't be invoked by the assistant, and consuming projects that aren't linked write to local dirs CC never checks.

**Pattern D: Code-level enforcement missing** (2 items) — Missing imports after extraction and prop guessing waste build cycles. LSP plugins would catch these structurally.

**Pattern E: Platform friction** (2 items) — `disable-model-invocation` error is opaque; system prompt auto-memory conflicts with omega. Workarounds only.

## Workstream 1: Plan/Execute Pipeline

### 1a. Plan Phase 8 — action note quality gate
**File:** `templates/skills/plan/SKILL.md` (Phase 8: Create the Work Item)

Add a mandatory quality check before filing actions to pib-db. After drafting action notes, apply the cold-start readiness check (already in Phase 6d) to each action's notes independently:
- Does the implementation section specify exact endpoints, methods, request/response formats?
- Are code examples included for non-obvious patterns?
- Do acceptance criteria only reference things described in the implementation section?
- Could a developer reading only this action's notes implement without questions?

The bar: "If a capable developer reads only this action's notes and nothing else, can they implement it correctly?"

**Addresses:** article-rewriter plan-action-detail-level (high), plan-creates-ephemeral-files (high)

### 1b. Plan Phase 6 — convention check
**File:** `templates/skills/plan/SKILL.md` (Phase 6: Completeness Check)

Add a fifth completeness check (6e):

**e. Convention consistency.** "If the plan defines multiple endpoints, APIs, components, or interfaces, does it define shared conventions (response envelope, error format, naming scheme)? If not, add a Phase 0 action that defines conventions before implementation begins."

**Addresses:** article-rewriter plan-missing-api-conventions (moderate)

### 1c. Plan — auto-inject deviation AC
**File:** `templates/skills/plan/SKILL.md` (Phase 8 or new Guardrails subsection)

Every action created by /plan automatically includes this acceptance criterion:
`[manual] If implementation deviated from this plan, all downstream actions in this project were reviewed and updated to reflect the actual state before marking this action complete.`

Injected by the skill, not left to the user.

**Addresses:** article-rewriter plan-deviation-safeguard (moderate)

### 1d. Execute — mandatory spec read before building
**File:** `templates/skills/execute/SKILL.md` (Step 1: Load the Plan)

Add a mandatory pre-build step after loading the plan reference: read the FULL action notes via `pib_query` or CLI. If notes are truncated in the query response, re-query with a direct SELECT for that action's full notes field. Do not proceed to implementation until full spec is loaded.

At completion (Step 8), before marking done: compare implementation output against every component and acceptance criterion listed in the notes. Flag gaps.

**Addresses:** article-rewriter execute-must-read-full-action-notes (high)

### 1e. Execute — type-check after extraction
**File:** `templates/skills/execute/SKILL.md` (Step 4: Implement)

Add to the file-group implementation loop: "After any component extraction or significant refactoring within a file group, run the project's type-checker (`tsc --noEmit`, or equivalent from `phases/validators.md`) immediately — before writing any other code. This catches broken imports and type mismatches before they compound."

**Addresses:** article-rewriter execute-missing-imports-after-extraction (moderate)

### 1f. Execute — verify framework props before use
**File:** `templates/skills/execute/SKILL.md` (Step 4: Implement, or new Guardrails section)

Add: "When using a UI component prop you haven't verified in this session, read the component's type definition (`.d.ts` in `node_modules` or source) before writing the code. One Read call costs less than three failed builds."

**Addresses:** article-rewriter ui-framework-prop-guessing (moderate)

## Workstream 2: Orient/Context Gaps

### 2a. Orient — deployment context in default briefing
**File:** `templates/skills/orient/SKILL.md` (Step 1: Load Context, Default behavior)

Add to the default context loading: "Check for deployment indicators: `git remote -v`, presence of `railway.toml`/`fly.toml`/`Dockerfile`/`vercel.json`/CI config. If a deployment method is detected, surface it in the briefing under a 'Deployment' heading with the deploy command."

**Addresses:** theater-cheater orient-doesnt-surface-deployment-method (high)

### 2b. Orient — enforce omega query structurally
**File:** `templates/skills/orient/SKILL.md` (Step 1: Load Context, Default behavior)

Strengthen the omega query from "query for additional context" to a required step: "If omega is configured (check for `~/.claude-cabinet/omega-venv/bin/omega`), the omega query is MANDATORY. If the query is skipped or fails silently, the briefing must include a warning: '⚠ Omega context not loaded — prior session decisions may be missing.'"

**Addresses:** theater-cheater orient-skipped-omega-query (high)

### 2c. Orient — flush feedback outbox
**File:** `templates/skills/orient/SKILL.md` (Step 1: Load Context, Default behavior)

Add to the default context loading: "Check `~/.claude/cc-feedback-outbox.json` for pending items. If this is the CC source repo (check package.json name), flush pending items to `feedback/` and mark them delivered. If this is a consuming project, surface count of pending items: 'You have N unsent feedback items in the outbox.'"

**Addresses:** claude-cabinet outbox-has-no-auto-flush (high)

### 2d. Orient — feedback memory enforcement at point of use
**File:** This is a harder problem. The feedback says memories loaded at orient don't influence behavior later in the session. Options:

**Option A (structural — hook-based):** Create a PreToolUse hook that fires before Edit/Write on files matching certain patterns (e.g., `**/playwright*`, `**/puppeteer*`, automation files). The hook reads high-severity feedback memories from omega and injects them as context. This is ~100% compliance but requires hook infrastructure per project.

**Option B (compliance-layer — skill text):** Add to execute SKILL.md: "Before editing files in the plan's surface area, re-query omega for feedback memories related to the file type or domain. Apply them." This is ~60-80% compliance.

**Option C (hybrid):** Add a `surface_memories` omega hook on PreToolUse that already exists in the omega native hooks. Verify it's working; if not, diagnose why.

**Recommend: Option C first** — verify the existing `surface_memories` hook is functioning. If it is, this is already solved structurally. If not, fix it. Only fall back to A or B if the hook can't cover this case.

**Addresses:** theater-cheater feedback-memories-loaded-but-not-applied (high)

## Workstream 3: Feedback Delivery Pipeline

### 3a. Remove disable-model-invocation from cc-feedback
**File:** `templates/skills/cc-feedback/SKILL.md`

Remove `disable-model-invocation: 'true'` from the frontmatter. The user saying "file cc-feedback" is clear delegation intent. If the skill is safe for the human to run, it's safe for the assistant to run on their behalf.

**Addresses:** theater-cheater disable-model-invocation-opaque (moderate), article-rewriter cc-feedback-not-model-invocable (moderate)

### 3b. Architecture member plan directive — add convention check
**File:** `templates/skills/cabinet-architecture/SKILL.md`

Update the `directives.plan` to include: "Check whether the plan defines shared conventions (response format, error codes, naming) for any multi-endpoint or multi-component system. Flag missing conventions as a CONDITIONAL concern."

**Addresses:** article-rewriter plan-missing-api-conventions (the cabinet-architecture angle)

## Workstream 4: Structural Code Enforcement

### 4a. Document LSP plugin recommendation in execute skill
**File:** `templates/skills/execute/SKILL.md` (new section or Guardrails)

Add: "If the project uses TypeScript and the `typescript-lsp` plugin is not installed, recommend it during pre-implementation review. LSP plugins provide automatic diagnostics after edits — catching missing imports, type mismatches, and invalid props without manual compiler runs. Install via `/plugin install typescript-lsp@claude-plugins-official`."

Similarly for other languages with available LSP plugins.

**Addresses:** article-rewriter execute-missing-imports (structural), article-rewriter ui-framework-prop-guessing (structural)

### 4b. cc-health — LSP plugin health check
**File:** `templates/skills/cabinet-cc-health/SKILL.md`

Add a health check: "If the project uses TypeScript (has tsconfig.json), check whether the TypeScript LSP plugin is installed. If not, flag as a health concern: 'TypeScript LSP plugin not installed — Claude cannot automatically detect type errors after edits.'"

## Items Acknowledged but NOT Addressed Here

### Platform issues (can't fix in CC)
- **Worktree branches from remote** — Claude Code platform behavior. Workaround: push before worktree agents.
- **Auto-memory system prompt conflicts with omega** — The system prompt's file-based memory instructions override project-level omega config. Workaround: CLAUDE.md already says to use omega. Could strengthen memory-capture.md rules file, but the system prompt is louder.

### Positive signal (no fix needed)
- **Plan critique caught auth gaps early** — Validates the plan→critique workflow works for security-sensitive features. No action needed.

### Process observation (no specific fix)
- **Phase files mix gathering and acting** (flow) — The suggestion for `blocking` sub-steps in phase files is interesting but adds phase system complexity. Revisit if the pattern recurs beyond flow.

## Surface Area
- files: templates/skills/plan/SKILL.md
- files: templates/skills/execute/SKILL.md
- files: templates/skills/orient/SKILL.md
- files: templates/skills/cc-feedback/SKILL.md
- files: templates/skills/cabinet-architecture/SKILL.md
- files: templates/skills/cabinet-cc-health/SKILL.md

## Acceptance Criteria
- [manual] Plan skill Phase 8 includes action-note quality gate text
- [manual] Plan skill Phase 6 includes convention consistency check (6e)
- [manual] Plan skill auto-injects deviation AC on every action
- [manual] Execute skill Step 1 requires full spec read before building
- [manual] Execute skill Step 4 includes type-check-after-extraction rule
- [manual] Execute skill Step 4 includes verify-props-before-use rule
- [manual] Orient default context loads deployment indicators
- [manual] Orient default context makes omega query mandatory with warning on skip
- [manual] Orient default context checks and flushes feedback outbox
- [manual] surface_memories hook verified working or diagnosed
- [manual] cc-feedback disable-model-invocation removed
- [manual] cabinet-architecture plan directive includes convention check
- [manual] Execute skill documents LSP plugin recommendation
- [manual] cc-health includes LSP plugin health check
- [auto] `node -c lib/cli.js` passes after all changes
- [auto] All modified template SKILL.md files parse valid YAML frontmatter
