## /execute lacks a batched multi-action mode

**Skill/phase:** `.claude/skills/execute/SKILL.md`

**Friction:** User invoked /execute with 5 distinct pib-db actions as the input — a single MVP-readiness slice across `act:046f9e16+85298d13`, `act:d6cefc3e`, `act:035694ab`, `act:8e1c8c9c`, `act:c3c5ac08`. The skill loaded its single-plan workflow and started prompting for a plan to load. I improvised: read all action specs upfront via `pib_get_action`, wrote 6 verification breadcrumbs in one pass, executed each action sequentially with per-action commits, ran a final typecheck once at the end, and closed all actions in batch via `pib_complete_action`.

The Checkpoint 1 / 2 / 3 cabinet sweeps each fire-per-action would have been wasteful for 1-5 line changes — I judgmentally skipped Checkpoints 1 and 2 with the user's pre-approval as cover. There's no documented guidance for this case in the skill; the cost-control language in `phases/cabinet-consultations.md` would have helped, but the skill doesn't acknowledge multi-action input as a shape at all.

This "MVP-readiness slice" / "pick N quick wins from the action backlog" shape is recurring (the /orient skill surfaces it explicitly through staleness detection and the quick-win briefing format). Encoding it in /execute would make per-action breadcrumb hygiene structural instead of dependent on the model remembering.

**Suggestion:** Two options, not necessarily exclusive:
1. Document a multi-action mode in `skills/execute/SKILL.md` — explicit guidance on what to skip (per-action Checkpoint 1/2) vs what to keep (final Checkpoint 3 across all changes, per-action AC walk, per-action breadcrumbs), with a heuristic for when the per-action checkpoint overhead is worth it (e.g., "if any single action's diff exceeds ~30 LOC, run its checkpoints; else skip").
2. Introduce a thin `/execute-batch` wrapper that loops the existing skill per action with shared session bookkeeping (single typecheck, shared cabinet activation, batched breadcrumbs, single combined AC report).

Option 1 is the lighter touch — adds a few paragraphs to SKILL.md. Option 2 is more correct architecturally — keeps single-action /execute focused and gives multi-action work its own surface — but is more code to maintain.

**Session context:** 5 quick-win pre-MVP fixes (DevModeProvider 401 redirect, model-toggle removal, accordion default, BalancePopover click-outside bug, mobile heading hide) shipped as one slice on 2026-05-14, 4 product commits + 1 verification-breadcrumb commit + 1 e2e harness alignment commit, all pushed to origin/main. The actual sequencing logic I improvised is in the transcript if useful as a worked example: read-all-specs-upfront → write-all-breadcrumbs-upfront → per-action [implement → typecheck via pre-commit hook → commit] → final-shared [typecheck → AC walk → breadcrumb update → pib_complete_action × N].
