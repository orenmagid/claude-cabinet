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

**Corrected mechanism (anthropic-insider fixed my original false claim):**
The reason checkpoints can't run in a worktree is NOT "subagents can't
invoke skills" — they can, via the Skill tool. The real reason:
`/execute`'s checkpoints **spawn one Agent per cabinet member**, and
**subagents cannot spawn subagents** (Claude Code forbids nesting —
sub-agents docs). So even if a worktree agent invoked `/execute`, the
checkpoint spawns would no-op. Cabinet review must therefore happen in
the **main session**, which can spawn agents.

## Design constraints (from planning discussion)

1. Updates to `/execute`'s checkpoints must flow to the group runner →
   single source of truth (extract shared protocol).
2. execute-plans only generates; execution has no real invocation
   boundary → execution becomes its own deliberately-invoked skill.
3. Prose checkpoints get skipped → gate them structurally. **But the
   gate has a known ceiling (see Gate v1 below): it proves agents were
   spawned, not that the right members reviewed. Honest framing
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

### Piece 3 — New `/execute-group` skill

`templates/skills/execute-group/SKILL.md`, `disable-model-invocation:
true` (the platform's deliberate-invocation primitive — this IS the
invocation boundary). Argument: `/execute-group <label>`.

1. **Re-validate the group (staleness guard):** query actions tagged
   `grp:<label>`. Confirm all still open. Re-run the conflict check on
   their CURRENT surface areas (reuse `build-conflict-graph.js`). If the
   stored hash differs or any conflict appears, HALT: "group drifted
   since generation, re-run /generate-plan-groups." The persisted group
   is a hint, not a contract.
2. **Checkpoint 1 (main session):** read `cabinet/checkpoint-protocol.md`,
   spawn cabinet members against the group's aggregate surface area.
   Write `.claude/verification/group-<label>-cp1.json` recording each
   spawned agent's **real agentId** (from the Agent tool result),
   members, verdicts.
3. **Parallel implementation:** spawn one worktree Agent per plan
   (unchanged — implementation only).
4. **Sequential merge + per-plan /validate** (today's step 5c).
5. **Checkpoint 3 (main session):** spawn cabinet members on the merged
   group diff. Write `group-<label>-cp3.json` with real agentIds.
6. **Mark plans complete** — gated (Piece 4).

### Piece 4 — Gate v1 (transcript agentId verification — honest ceiling)

**What it does:** the breadcrumb records the real `agentId` of each
spawned cabinet agent. A hook reads the live session transcript
(available via `transcript_path` on the hook's stdin JSON) and verifies
the breadcrumb's agentIds actually appear at `toolUseResult.agentId` in
the transcript, are distinct, and meet the required count.

**What it defeats:** invented agentIds (not in transcript), reused IDs
(must be N distinct). The cheap fakes die.

**Its honest ceiling (state this in the skill + plan, do NOT overclaim):**
all cabinet spawns are `subagent_type: general-purpose`; cabinet
identity lives only in model-authored prompt/description text, which is
spoofable. So Gate v1 proves *"N distinct real review agents were
spawned in this session before completion"* — NOT that the correct
members reviewed, nor that they reviewed well. It raises the bar from
existence-only to spawn-proof. It is not "checkpoints guaranteed."

**Mechanism:**
- cp3 / completion gate: **extend the existing `action-completion-gate.sh`**
  (PreToolUse on `pib_complete_action` — a real MCP tool boundary). When
  the action carries a `grp:` tag, additionally require a valid
  `group-<label>-cp3.json` whose agentIds verify against the transcript.
  cp1 is enforced transitively (no valid cp1 breadcrumb → cp3 invalid →
  completion blocked).
- cp1 / merge gate (optional hardening): a NEW Bash-matched PreToolUse
  hook (`if: "Bash(git *)"`, modeled on `git-guardrails.sh` which
  already gates git subcommands) that blocks the group merge if
  `group-<label>-cp1.json` is missing/unverifiable. Feasible per
  anthropic-insider; secondary to the completion gate.
- Block messages MUST include the manual recovery path (mirror
  `action-completion-gate.sh` lines 25-26) so a blocked power-user
  isn't dead-ended.
- Use the current hook decision schema
  (`hookSpecificOutput.permissionDecision: deny`).

**Auto-upgrade path:** when the separate "cabinet-as-registered-
subagent-types" initiative lands (filed separately), `subagent_type`
becomes trustworthy and Gate v1 upgrades to identity-verifying for free
— the breadcrumb already records IDs; the gate just gains a trustworthy
type to check. Note this in the skill so the upgrade is obvious later.

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
- files: templates/cabinet/checkpoint-protocol.md (new — extracted)
- files: templates/skills/execute/SKILL.md (replace inline checkpoints with imperative read-reference)
- files: templates/hooks/action-completion-gate.sh (extend: group cp3 + transcript verify)
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
- [auto] execute-group/SKILL.md exists; reads cabinet/checkpoint-protocol.md (grep); has disable-model-invocation: true; spawns worktree agents; writes group-<label>-cp1.json with agentIds before merge.
- [auto] cabinet/checkpoint-protocol.md exists; execute/SKILL.md references it (grep) and no longer inlines full Checkpoint 1/2/3 prose.
- [auto] Gate unit test: feed action-completion-gate.sh a synthetic stdin JSON (tool_input with a grp: tag + transcript_path to a fixture JSONL) — with a cp3 breadcrumb whose agentIds ARE in the fixture → allow; with agentIds NOT in the fixture → deny; with reused (non-distinct) IDs → deny. Pure shell test, no live platform dependency.
- [auto] lib/cli.js planning module lists generate-plan-groups + execute-group, not execute-plans; manifest-migration block has the rename mapping; node -c passes.
- [auto] skill-validator passes on generate-plan-groups, execute-group, execute.
- [manual] Rename migration: install old execute-plans dir in a tmp project, run upgrade, confirm orphan dir removed + new skills present.
- [manual] Staleness guard: tag a group, change one plan's surface area, run /execute-group <label> → halts with drift message.
- [manual, smoke] End-to-end via /verify scenario: generate-plan-groups produces + tags groups; /execute-group runs cp1 (cabinet spawned, real agentIds recorded) → parallel impl → cp3 → gated completion.

## Why This Approach (honest version)

- **Split + deliberate invocation** makes checkpoints focused and likely
  (fresh skill context, `disable-model-invocation` boundary). It does
  NOT by itself force checkpoints — that's the gate's job.
- **Extraction** kills copy-drift (the v0.27.0 MEMORY_HOOKS class).
- **Gate v1** converts existence-only into spawn-proof. Honest ceiling:
  proves agents spawned, not that review happened. Auto-upgrades when
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
- Gate boundary: extend completion gate (cp3, MCP boundary) + optional
  new Bash hook (cp1/merge). DECIDED.
- Gate ceiling: Gate v1 spawn-proof now; identity-verifying after the
  separate cabinet-subagent-types initiative. DECIDED.
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
