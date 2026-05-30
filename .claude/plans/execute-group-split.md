# Plan: Split execute-plans into generator + gated runner (v0.28.0)

**Sequencing: v0.28.0, AFTER the omega Phase 8 consumer walk ships.**
This plan and the omega consumer-migration work both edit `lib/cli.js`'s
manifest-migration block and the cc-upgrade detection phases. Serialize
them — do not start this until omega Phase 8 (`act:21b9218f`) is done.

## Problem

`/execute-plans` silently drops cabinet checkpoints. It's a scheduler
(fetch open plans → conflict graph → parallel groups) that *also*
claims to execute. Step 5a spawns a worktree Agent per plan with the
prose "Use the /execute skill's checkpoint protocol." The checkpoints
never run. The guarantee is invisible-by-omission.

**Corrected mechanism (empirically verified 2026-05-30):**
The reason checkpoints can't run in a worktree is NOT "subagents can't
invoke skills" — they can, via the Skill tool. The real reason:
`/execute`'s checkpoints **spawn one Agent per cabinet member**, and
**worktree agents do NOT have access to the Agent tool** (empirically
confirmed — the tool simply doesn't appear in their tool list). So even
if a worktree agent invoked `/execute`, the checkpoint spawns would
no-op. Cabinet review must therefore happen via the **Workflow tool**,
which is not subject to the agent nesting restriction.

## Design constraints (from planning discussion)

1. Updates to `/execute`'s checkpoints must flow to the group runner →
   single source of truth (extract shared protocol).
2. execute-plans only generates; execution has no real invocation
   boundary → execution becomes its own deliberately-invoked skill.
3. Prose checkpoints get skipped → gate them structurally. **But the
   gate has a known ceiling (see Gate v1 below): it proves the workflow
   ran all checkpoints, not that the review was thorough. Honest framing
   required — do NOT claim "checkpoints guaranteed."**

## Pieces

### Piece 0 — Interim honesty (ship FIRST, standalone, independent of all else)

Today `/execute-plans` actively lies to worktree agents ("use the
/execute protocol" they can't honor). One-line-edit fix, ship
immediately regardless of the rest:
- Delete the false "Use the /execute skill's checkpoint protocol"
  instruction from the worktree-agent prompt.
- Add a caveat to the skill output: "Worktree agents do NOT run cabinet
  checkpoints — they implement + validate only. For cabinet review, run
  /execute per plan, or accept the parallel/no-checkpoint trade."

### Piece 1 — Extract shared checkpoint protocol (also standalone-valuable)

Create `templates/cabinet/checkpoint-protocol.md` = single source of
truth for the cabinet checkpoint mechanism (spawn members matching
surface area + standing mandate, collect verdicts, escalation: any
stop → halt, any pause → present options, 3+ pause → stop-equivalent).

- Extract from `templates/skills/execute/SKILL.md` (Checkpoints 1/2/3).
- Both `/execute` and `/execute-group` say, as an **imperative step**:
  "Read `cabinet/checkpoint-protocol.md` and follow it, scoped to
  [pre-impl | this file group | pre-commit | this group's aggregate]."
  Not a citation — an instruction to read (the pattern CC skeletons
  already use reliably).
- Add a `/validate` validator that greps both skills for the
  read-instruction, so drift-by-deletion is caught.

### Piece 2 — Rename `execute-plans` → `generate-plan-groups`

Generator-only. Fetch plans → conflict graph → present groups →
**persist via the existing pib-db `tags` column** (migration v2 — NO
schema change) → stop. Delete steps 5-8 (execution).

- Rename dir + frontmatter `name`. Keep `disable-model-invocation: true`.
- Rewrite description: "Find open plans with surface-area declarations,
  build a conflict graph, persist conflict-free parallel execution
  groups. Does NOT execute — hand each group to /execute-group."
- Persistence: tag each grouped action `grp:<YYYY-MM-DD-N>`. Also tag
  with `grp-generated:<ISO>` + a hash of the input surface areas (for
  staleness detection in Piece 3).
- **Rename migration (workflow-cop blocking):**
  - `lib/cli.js` manifest-key migration block: map old
    `skills/execute-plans/*` manifest keys → `skills/generate-plan-groups/*`
    so the installer cleanup removes the orphan dir (precedent: the
    `perspectives → cabinet-*` block already there).
  - cc-upgrade detection phase (model on `omega-migration-detect.md`):
    detect `.claude/skills/execute-plans/` on disk, explain the rename,
    remove the orphan. Otherwise `/execute-plans` muscle-memory keeps
    running the old checkpoint-dropping skill.

### Piece 3 — New `/execute-group` skill + workflow

**Architecture: Workflow-Orchestrated Parallel Execution**

The skill is a thin launcher that validates preconditions (staleness
guard) and hands off to a workflow script (`execute-group.js`). The
workflow script is the single orchestrator — it spawns all agents
directly using `agent()`, `parallel()`, and sequential loops. No agent
nesting required.

**Why workflow, not Agent tool:** Worktree agents do NOT have access to
the Agent tool (empirically verified 2026-05-30). They cannot spawn
cabinet sub-agents for checkpoints. The workflow script solves this by
being the orchestrator itself — it spawns worktree agents for
implementation AND cabinet agents for review as first-class parallel
participants. Precedent: `templates/workflows/deliberative-audit.js`
already does multi-stage agent orchestration with parallel spawning.

`templates/skills/execute-group/SKILL.md`, `disable-model-invocation:
true`. Argument: `/execute-group <label>`.

**Skill steps (before workflow launch):**

1. **Re-validate the group (staleness guard):** query actions tagged
   `grp:<label>`. Confirm all still open. Re-run the conflict check on
   their CURRENT surface areas (reuse `build-conflict-graph.js`). If the
   stored hash differs or any conflict appears, HALT: "group drifted
   since generation, re-run /generate-plan-groups." The persisted group
   is a hint, not a contract.
2. **Launch workflow `execute-group.js`** with args:
   `{ label, plans, cabinetMembers, checkpointProtocol }`

**Workflow flow (`execute-group.js`):**

```
Phase: CP1 — Pre-Implementation Review
  1. Group-level CP1: spawn cabinet agents on aggregate surface area (parallel)
  2. Per-plan CP1: spawn cabinet agents per plan (parallel)
  3. Collect verdicts, apply escalation (any stop → halt, 3+ pause → halt)

Phase: Implement — Parallel Worktree Agents
  4. One worktree agent per plan via parallel()
     Each agent: write breadcrumb, implement, run /validate, verify [auto] ACs,
     update affected .feature files, commit in worktree
  5. Filter null results (failed agents are not merged)

Phase: Merge & Per-Plan CP3 — Sequential
  6. For each completed worktree (sequential for-loop):
     a. Idempotency check: already merged? → skip
     b. Branch-existence check: no branch → log, skip
     c. Merge worktree branch into main
     d. Run /validate on main (fail → revert, park, continue)
     e. Per-plan CP3: spawn cabinet agents on merged diff (parallel)
        CP3 stop → revert merge, park branch, log

Phase: Final Integration
  7. Full /validate on main
  8. Breadcrumb audit: verify all N breadcrumbs exist and are valid
  9. Compile integration summary

Phase: Group CP3 — Informed Final Review
  10. Spawn cabinet agents with: aggregate diff + validation + AC status
      + deviations + scenarios updated

Phase: Completion
  11. Manual ACs → new pib-db actions
  12. Mark completed plans done (breadcrumb-gated)
  13. Generate Completion Report (final workflow output)
```

**Completion Report structure:**
```json
{
  "plans_executed": "N of M",
  "per_plan": [{
    "fid": "act:xxx", "text": "...",
    "status": "merged | parked | failed-impl",
    "auto_ac": { "total": 4, "passed": 4, "failed": 0 },
    "manual_ac_actions": ["act:new123"],
    "scenarios_updated": ["e2e/features/billing.feature"],
    "deviations": [], "cp3_verdict": "continue"
  }],
  "checkpoints": {
    "cp1_group": "continue",
    "cp1_per_plan": [{"fid": "act:xxx", "verdict": "continue"}],
    "cp3_per_plan": [{"fid": "act:xxx", "verdict": "continue"}],
    "cp3_group": "continue",
    "integration": { "validate": "pass", "breadcrumbs": "valid" }
  },
  "loose_ends": []
}
```

**Known limitations (honest ceiling):**
- No mid-implementation CP2 (worktree agents can't spawn reviewers)
- Surface area is intent, not reality (under-declaration → semantic conflicts
  only caught by CP3)
- Feature file "affect" is heuristic

### Piece 4 — Gate v1 (Completion Report verification — honest ceiling)

**What it does:** extends `action-completion-gate.sh` (PreToolUse on
`pib_complete_action`) to check the workflow's Completion Report when
an action carries a `grp:` tag. The report is the ground truth — the
workflow either ran the checkpoints or it didn't. No transcript parsing
needed.

**What it defeats:** skipping the workflow and completing directly;
workflow completing without all required checkpoints passing. The
workflow's structured output IS the evidence.

**Its honest ceiling (state this in the skill + plan, do NOT overclaim):**
Gate v1 proves *"the workflow ran, all checkpoints returned 'continue',
and the plan was merged"* — NOT that the correct cabinet members
reviewed, nor that they reviewed well. It is not "checkpoints
guaranteed." Auto-upgrades when cabinet-as-subagent-types lands
(`.claude/agents/cabinet-*.md` wrappers already exist — waiting for
platform support).

**Gate checks (when action carries `grp:` tag):**

1. **Breadcrumb exists** — `.claude/verification/<fid>.json` with:
   - `spec_read: true`, `ac_verified: true`, `scenarios_updated` field
2. **Completion Report exists** — `.claude/verification/group-<label>-report.json`
   with this plan's fid in `plans_executed` with status `"merged"`,
   `checkpoints.cp3_group: "continue"`, `checkpoints.integration.validate: "pass"`
3. **Manual ACs tracked** — if breadcrumb has non-empty `manual_ac_deferred`,
   corresponding pib-db actions must exist

**Block message MUST include manual recovery path:**
```
BLOCKED: Action <fid> has grp:<label> tag but completion requirements not met.
Missing: [breadcrumb | completion-report | manual-ac-actions]
To complete manually: pib_complete_action --force <fid>
To investigate: cat .claude/verification/<fid>.json
```

Use `hookSpecificOutput.permissionDecision: deny`.

**Optional: Group Checkpoint Gate** (`templates/hooks/group-checkpoint-gate.sh`)
— Bash-matched gate that blocks `git merge` if group CP1 breadcrumb is
missing. Advisory (not blocking by default, enable per-project).

### Piece 5 — Documentation sweep

- `lib/cli.js:387` planning module: `'skills/execute-plans'` →
  `'skills/generate-plan-groups'`, add `'skills/execute-group'`.
- `templates/README.md`: rewrite descriptions; add the 3 new artifacts.
- `templates/skills/plan/SKILL.md` + any "then /execute-plans" → the new
  two-step flow.
- Historical pib-db actions mentioning execute-plans: leave (history).

## Surface Area

- dirs: templates/skills/generate-plan-groups/ (renamed from execute-plans/)
- files: templates/skills/generate-plan-groups/SKILL.md (renamed + rewritten)
- files: templates/skills/generate-plan-groups/scripts/build-conflict-graph.js (moved)
- files: templates/skills/execute-group/SKILL.md (new)
- files: templates/workflows/execute-group.js (new — workflow orchestrator)
- files: templates/cabinet/checkpoint-protocol.md (new — extracted)
- files: templates/skills/execute/SKILL.md (replace inline checkpoints with imperative read-reference)
- files: templates/hooks/action-completion-gate.sh (extend: grp: tag → Completion Report check)
- files: templates/hooks/group-checkpoint-gate.sh (new — optional cp1/merge Bash gate)
- files: templates/skills/validate/phases/validators.md (add protocol-reference grep validator)
- files: templates/skills/cc-upgrade/phases/execute-plans-rename-detect.md (new — orphan cleanup)
- files: lib/cli.js (planning module list + manifest-key rename migration)
- files: templates/README.md
- files: templates/skills/plan/SKILL.md (downstream reference)

## Acceptance Criteria

- [auto] templates/skills/execute-plans/ gone; templates/skills/generate-plan-groups/ exists.
- [auto] grep -rl "execute-plans" templates/ lib/ → 0 (excluding changelog/comments + the cc-upgrade rename-detect phase which intentionally names it).
- [auto] generate-plan-groups/SKILL.md: name is generate-plan-groups; description contains "does NOT execute"; grep "isolation.*worktree" → 0 (no execution step).
- [auto] execute-group/SKILL.md exists; reads cabinet/checkpoint-protocol.md (grep); has disable-model-invocation: true; references execute-group.js workflow.
- [auto] execute-group.js exists with valid meta block, uses parallel() for CP1/implementation/per-plan-CP3, sequential for-loop for merges, produces Completion Report.
- [auto] cabinet/checkpoint-protocol.md exists; execute/SKILL.md references it (grep) and no longer inlines full Checkpoint 1/2/3 prose.
- [auto] Gate unit test: feed action-completion-gate.sh synthetic stdin with grp: tag. Valid breadcrumb + valid Completion Report (plan "merged", cp3_group "continue") → allow. Missing breadcrumb → deny. Missing report → deny. Report shows plan as "parked" → deny. Pure shell test.
- [auto] lib/cli.js planning module lists generate-plan-groups + execute-group, not execute-plans; manifest-migration block has the rename mapping; node -c passes.
- [auto] skill-validator passes on generate-plan-groups, execute-group, execute.
- [manual] Rename migration: install old execute-plans dir in a tmp project, run upgrade, confirm orphan dir removed + new skills present.
- [manual] Staleness guard: tag a group, change one plan's surface area, run /execute-group <label> → halts with drift message.
- [manual, smoke] End-to-end: generate-plan-groups produces + tags groups; /execute-group runs CP1 (cabinet spawned via workflow) → parallel impl → CP3 → Completion Report produced → gate allows completion.

## Why This Approach (honest version)

- **Split + deliberate invocation** makes checkpoints focused and likely
  (fresh skill context, `disable-model-invocation` boundary). It does
  NOT by itself force checkpoints — that's the gate's job.
- **Extraction** kills copy-drift (the v0.27.0 MEMORY_HOOKS class).
- **Workflow orchestration** solves the agent-nesting problem cleanly:
  workflow script spawns both worktree agents AND cabinet reviewers as
  first-class participants. No transcript parsing needed.
- **Gate v1** checks the Completion Report — the workflow's structured
  output. Honest ceiling: proves the workflow ran with all checkpoints
  passing, not that the review was thorough. Auto-upgrades when
  cabinet-as-subagent-types lands.
- **Parallelism preserved**; group-level cp3 catches cross-plan
  interactions per-plan review misses (genuine upside).
- **Known limitation carried forward:** per-file-group Checkpoint 2
  (mid-implementation) does not run in the parallel path. For a plan
  whose diff is large or touches high-risk surface, the operator should
  run full `/execute` on it individually instead of via a group. Document
  this; do not pretend group review substitutes for it.

## Resolved (was Open Questions)

- Persistence: pib-db `tags` column. DECIDED.
- Orchestration mechanism: Workflow tool (not Agent tool — worktree agents
  lack Agent tool access, empirically verified 2026-05-30). DECIDED.
- Gate boundary: extend completion gate (cp3, MCP boundary) checking
  Completion Report + optional new Bash hook (cp1/merge). DECIDED.
- Gate verification: Completion Report (not transcript agentId parsing —
  the report IS the workflow's execution record). DECIDED.
- Gate ceiling: Gate v1 proves workflow ran checkpoints; identity-verifying
  after cabinet-as-subagent-types initiative. DECIDED.
- Large-plan escape: run individual /execute, not a group. DECIDED
  (documented, not auto-enforced).

## Relationship to other work

- **Depends on / sequenced after:** omega Phase 8 consumer walk
  (`act:21b9218f`) — shared edits to cli.js manifest-migration + cc-upgrade.
- **Spawns sibling initiative:** "Register cabinet members as Claude Code
  subagent types" — makes `subagent_type` trustworthy, upgrades Gate v1
  to identity-verifying, improves EVERY cabinet checkpoint (audit, plan,
  execute) system-wide. Filed separately; large; not a dependency of
  this plan (Gate v1 ships without it).
- **Distinct from** `act:c77f451b` (multi-action /execute input batching).
