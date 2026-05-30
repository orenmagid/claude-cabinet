---
name: execute-group
description: |
  Run one parallel plan group produced by /generate-plan-groups. Validates
  the group hasn't drifted, then launches the execute-group workflow:
  cabinet pre-review, parallel worktree implementation, sequential merge with
  per-plan review, integration check, informed final review, and a completion
  report. Use when: "execute group", "run group", "/execute-group".
disable-model-invocation: true
argument-hint: "group label — e.g., '2026-05-30-1'"
related:
  - type: skill
    name: generate-plan-groups
  - type: skill
    name: execute
  - type: file
    path: .claude/cabinet/checkpoint-protocol.md
    role: "The cabinet checkpoint mechanism — the workflow's review agents read and follow it"
  - type: file
    path: .claude/workflows/execute-group.js
    role: "The orchestrator this skill launches"
---

# /execute-group — Run a Generated Parallel Plan Group

## Purpose

`/generate-plan-groups` decides *what can run in parallel* and persists each
conflict-free group as pib-db `grp:` tags. This skill *runs one group*: it
re-checks the group is still safe, then hands off to a **workflow
orchestrator** (`execute-group.js`) that drives implementation and cabinet
review end to end.

**Why a workflow, not direct Agent-tool spawning:** worktree agents cannot
spawn sub-agents (no Agent-tool access — empirically verified). So a worktree
agent cannot run its own cabinet checkpoints. The workflow script solves this
by being the single orchestrator: it spawns worktree agents for
implementation AND cabinet agents for review as first-class parallel
participants. This is the capability the old all-in-one parallel-execution
skill could not provide.

## Prerequisites

- The group must have been produced by `/generate-plan-groups` (its plans
  carry `grp:<label>`, `grp-generated:`, and `grp-hash:` tags).
- Plans must still have `## Surface Area` sections in their notes.
- The Workflow tool must be available (the orchestrator runs as a workflow).

## Honest ceiling — read before relying on this

The workflow runs the checkpoints; it does not guarantee the *review was
thorough*. Specifically:

- **No mid-implementation (CP2) review.** Worktree agents implement without
  a reviewer looking over their shoulder. CP1 reviews before, CP3 reviews
  after. For a plan whose diff is large or touches high-risk surface, run
  `/execute <plan>` individually instead of via a group — full `/execute`
  has the per-file-group checkpoint this path sacrifices for parallelism.
- **Surface area is intent, not reality.** Under-declared surface area can
  hide a semantic conflict the conflict graph missed; only CP3 catches it.
- **Feature-file "affect" is heuristic.** Behavioral coupling not textually
  referenced may be missed.

## Workflow

### Step 1 — Staleness guard (skill-level, BEFORE launching)

The persisted group is a hint, not a contract. Re-validate it against the
*current* state before running:

1. **Fetch the group's plans.** Query actions whose `tags` contain
   `grp:<label>` (the argument). Use `pib_query` (or `node scripts/pib-db.mjs
   query`):
   ```sql
   SELECT a.fid, a.text, a.notes, a.tags
   FROM actions a
   WHERE a.completed = 0 AND a.deleted_at IS NULL
     AND a.tags LIKE '%grp:<label>%'
   ```

2. **Drop plans that are no longer open or lost their surface area.** Report
   each dropped plan and why.

3. **Recompute the surface-area hash and compare.** Recompute it **exactly
   as `/generate-plan-groups` did**: for every still-open plan in the group,
   parse its `## Surface Area` file/dir list, concatenate all entries across
   the group, sort, and hash. Compare to the `grp-hash:` token stored on the
   plans.
   - **Hash matches** → the group is current. Proceed.
   - **Hash differs** → a plan's surface area changed since grouping. **HALT:**
     > Group `<label>` has drifted since it was generated (surface areas
     > changed). Re-run `/generate-plan-groups` to regroup, then
     > `/execute-group` again.
     Do not run a stale group — the conflict-free guarantee no longer holds.

4. **Edge cases:**
   - **0 plans survive** the filter → tell the user the group is empty
     (all drifted/closed) and stop. Don't launch the workflow.
   - **1 plan survives** → you may still launch (the workflow skips
     group-level checkpoints for a single plan), or just suggest
     `/execute <plan>` directly. Single-plan groups gain nothing from the
     parallel machinery.

### Step 2 — Select cabinet members

Select the cabinet members the workflow's checkpoints will use. Use
`.claude/skills/_index.json`: members whose `standingMandate` includes
`execute`, plus any whose file patterns match the group's aggregate surface
area. For each, collect `{ key, agentType, path, directive }` (the
`agentType` is the registered `cabinet-<name>` subagent; `directive` is
`directives.execute` if present). The workflow's review agents each read
`.claude/cabinet/checkpoint-protocol.md` and follow it, scoped to the
checkpoint they run (group aggregate / pre-impl / post-merge).

If the project has no cabinet members, the workflow still runs — it just
skips the checkpoints (implementation + validate only). Say so.

### Step 3 — Launch the workflow

Invoke the Workflow tool with the orchestrator script and the assembled
arguments:

- **script:** `.claude/workflows/execute-group.js`
- **args:**
  ```json
  {
    "label": "<label>",
    "plans": [{ "fid": "...", "text": "...", "notes": "...", "surfaceArea": "..." }],
    "cabinetMembers": [{ "key": "...", "agentType": "cabinet-...", "path": "...", "directive": "..." }],
    "checkpointProtocolPath": ".claude/cabinet/checkpoint-protocol.md",
    "briefingPath": ".claude/cabinet/_briefing.md"
  }
  ```

Pass `plans` and `cabinetMembers` as real JSON arrays (not stringified).

### Step 4 — Present the Completion Report

The workflow returns a structured Completion Report. Present it plainly:
which plans merged, which parked/failed, the checkpoint verdicts, the
integration result, any new pib-db actions created for deferred manual ACs,
and the `loose_ends`. The report is also the evidence the completion gate
(`action-completion-gate.sh`) checks when a `grp:`-tagged plan is marked
done — don't discard it.

If the workflow halted early (a checkpoint returned `stop`, or integration
failed), report exactly where and why. Nothing was merged on a pre-merge
halt; on a post-merge CP3 stop, the offending plan was reverted.

## Principles

- **The group is a hint, not a contract.** Always re-validate (Step 1)
  before running. Regenerate freely.
- **The workflow is the single orchestrator.** Don't try to run the
  checkpoints from this skill — the whole point is that the workflow can
  spawn both implementors and reviewers, and a worktree agent cannot.
- **Sequential merges, parallel everything else.** Merges into main are
  serialized with `/validate` between them; CP1, implementation, and
  per-plan CP3 run in parallel.
- **Honest about the ceiling.** This runs the checkpoints; it does not prove
  the review was deep. For high-risk plans, prefer individual `/execute`.
