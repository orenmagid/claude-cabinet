---
name: generate-plan-groups
description: |
  Find open plans with surface-area declarations, build a conflict graph,
  and persist conflict-free parallel execution groups as pib-db tags. Does
  NOT execute — hand each group to /execute-group. Use when: "generate plan
  groups", "what can we build in parallel", "group plans for execution",
  "/generate-plan-groups".
disable-model-invocation: true
related:
  - type: skill
    name: plan
  - type: skill
    name: execute-group
  - type: skill
    name: execute
  - type: script
    path: .claude/skills/generate-plan-groups/scripts/build-conflict-graph.js
---

# /generate-plan-groups — Parallel Execution Grouping

## Purpose

Read open plans with surface-area declarations, determine which can safely
run in parallel (based on file/directory overlap), and **persist the
conflict-free groups** so `/execute-group` can run them. This skill is the
scheduler half of the plan→parallel-execution pipeline: it decides *what
can run together*, tags the plans, and stops.

**It does NOT execute anything.** No worktrees, no merges, no cabinet
checkpoints. Execution is a separate, deliberately-invoked step
(`/execute-group <label>`) — splitting generation from execution is what
lets `/execute-group` run cabinet checkpoints via a workflow orchestrator
that the old all-in-one skill could not.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration is generic. Your project defines specifics — where plans
come from, which files are known conflict sources — in phase files under
`phases/`.

### Phase File Protocol

Phase files have three states:

| State | Meaning |
|-------|---------|
| Absent or empty | Use this skeleton's **default behavior** for the phase |
| Contains only `skip: true` | **Explicitly opted out** — skip this phase entirely |
| Contains content | **Custom behavior** — use the file's content instead |

## Prerequisites

- Plans must have `## Surface Area` sections in their notes declaring
  which files and directories they touch
- Node.js available (for the conflict graph script)
- A work tracker with a tags column (pib-db) to persist the groups

## Workflow

### 1. Fetch Open Plans

Read `phases/fetch-plans.md` for where plans come from.

**Default (absent/empty):** Query pib-db for open actions that have
surface area declarations.

**Access method:** Use `pib_*` MCP tools when available (see
`.claude/cabinet/pib-db-access.md`), fall back to `node scripts/pib-db.mjs`
CLI.

Use `pib_query` (or `node scripts/pib-db.mjs query`) with:
```sql
SELECT a.fid, a.text, a.notes
FROM actions a
WHERE a.completed = 0 AND a.deleted_at IS NULL
  AND a.notes LIKE '%## Surface Area%'
ORDER BY a.sort_order
```

Projects using external APIs, different databases, or filtered project
areas should define this phase.

### 2. Parse Surface Areas

For each action, extract the `## Surface Area` section from notes.
Parse lines matching:
- `- files: path/to/file` — specific file
- `- dirs: path/to/dir/` — directory (conflicts with any file inside it)

**Format flexibility:** Real-world plans use varied formats. The parser
handles:
- Standard: `- files: path/to/file`
- Backtick-quoted: `` - files: `path/to/file` ``
- Bold: `- files: **path/to/file**`
- With markers: `- files: path/to/file (new)`

Skip actions without surface area declarations — they can't be scheduled
for parallel execution. Report them as "unschedulable."

### 3. Build Conflict Graph

Run the conflict detection script:
```bash
echo '$ACTIONS_JSON' | node .claude/skills/generate-plan-groups/scripts/build-conflict-graph.js
```

The script:
- Takes a JSON array of `{fid, text, notes}` on stdin
- Parses surface areas from notes
- Detects file-file, file-dir, and dir-dir overlaps
- Uses greedy graph coloring to find independent sets (parallel groups)
- Outputs groups, conflicts, file overlap matrix, and warnings

### 3a. Verify Grouping (MANDATORY)

After computing groups, print a **file overlap matrix** — for every file
that appears in any plan, show which group(s) contain plans that touch it:

```
File Overlap Check:
  src/api.ts → act:abc (Group 1), act:def (Group 2)  different groups
  server.js  → act:ghi (Group 1), act:jkl (Group 1)  CONFLICT
```

**If any file appears in two plans within the same group, STOP.**
Move the conflicting plan to a later group before proceeding.

This check catches the case where surface areas are correct but the
greedy coloring algorithm made a suboptimal assignment.

### 3b. Identify High-Conflict Files

Read `phases/high-conflict-files.md` for project-specific files that are
known conflict sources (shared entry points, barrel files, config files).

**Skip (absent/empty).** Projects that have discovered shared entry
points through experience should list them here so the grouping can
flag plans that touch them.

When two plans share any high-conflict file, they MUST be in different
groups — even if the changes seem independent.

### 4. Present the Groups

Show the user the computed grouping:

```
Group 1 (can run in parallel):
  - act:abc123 "Build /validate skill" → .claude/skills/validate/
  - act:def456 "Add calendar view" → src/pages/

Group 2 (conflicts with Group 1 — run after):
  - act:ghi789 "Refactor sidebar" → src/components/

Serial (conflicts with multiple groups):
  - act:jkl012 "Update shared config" → config.ts

Unschedulable (no surface area):
  - act:mno345 "Research caching strategies"
```

**Wait for explicit user approval before persisting the groups.**

### 5. Persist the Groups (pib-db tags)

Once the user approves, tag each grouped action so `/execute-group` can
find and re-validate it. Tags are comma-separated tokens in the action's
`tags` column. Write three tokens per action:

- `grp:<YYYY-MM-DD-N>` — the group label (N is the group number for this
  generation run, e.g. `grp:2026-05-30-1`). `/execute-group <label>` runs
  one group by this label.
- `grp-generated:<ISO-8601>` — when this grouping was computed.
- `grp-hash:<hash>` — a short hash of the group's combined surface-area
  declarations (concatenate every grouped action's parsed file/dir list,
  sorted, and hash it). `/execute-group` recomputes this at run time and
  **halts if it differs** — a drifted plan means the grouping is stale and
  must be regenerated.

Write the tags with `pib_update_action` (or CLI fallback):
```bash
node scripts/pib-db.mjs update-action <fid> --tags "grp:2026-05-30-1,grp-generated:2026-05-30T18:55:00Z,grp-hash:a1b2c3"
```

Preserve any existing non-`grp` tags on the action. Re-running generation
must re-tag cleanly rather than accumulating. Do it by **token**, not by
substring, so a tag like `regrp` or `grpx` is never clobbered:

1. Read the action's current `tags`, split on `,`, trim each token.
2. Drop only tokens whose prefix is **exactly** `grp:`, `grp-generated:`,
   or `grp-hash:` (i.e. the token starts with that literal including the
   colon). Keep everything else verbatim.
3. Append the three new `grp` tokens, re-join with `,`, and write back.

**Only `grp:` groups with 2+ plans are worth persisting.** A single-plan
"group" should just be run with `/execute <plan>` directly — say so rather
than tagging it.

### 6. Hand Off

Report the persisted group labels and stop:

```
Persisted 2 parallel groups:
  grp:2026-05-30-1 (2 plans) — run: /execute-group 2026-05-30-1
  grp:2026-05-30-2 (3 plans) — run: /execute-group 2026-05-30-2

Serial/unschedulable plans were not grouped — run those with /execute.
```

This skill ends here. `/execute-group <label>` owns worktree spawning,
cabinet checkpoints, merging, and completion.

## Principles

- **Surface areas are the contract.** If a plan's surface area is
  wrong (touches files it didn't declare), that's a plan quality issue.
  The conflict graph is only as good as the declarations.
- **Conservative scheduling.** When in doubt, serialize. False conflicts
  just slow things down; missed conflicts cause merge failures downstream.
- **The user approves the grouping** before it's persisted.
- **File-level precision beats conceptual grouping.** Two plans that
  "feel independent" can still conflict if they both touch a shared
  file. The grouping algorithm works at the file level, not the feature
  level.
- **Generation is cheap and repeatable.** The persisted group is a hint,
  not a contract — `/execute-group` re-validates it against current
  surface areas before running. Regenerate freely.

## Lessons Learned

These lessons come from real parallel grouping runs:

1. **Shared entry points are the #1 conflict source.** Root components,
   API endpoint files, barrel index files, and shared type files are
   touched by many plans. The file overlap matrix check (Step 3a) exists
   specifically to catch these. List yours in `phases/high-conflict-files.md`.

2. **The grouping must be verified, not just computed.** Even a correct
   graph-coloring algorithm can be undermined by inaccurate surface areas.
   The mandatory file overlap check is the safety net.

3. **Surface area formats vary wildly.** Plans written by different agents
   use different formats. The parser must be flexible — extract any
   recognizable file path, not just lines matching `- files:`.

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `fetch-plans.md` | Default: pib-db query for actions with surface areas | Where plans come from |
| `high-conflict-files.md` | Skip | Project-specific shared entry points |

## Extending

To customize a phase: write content in the corresponding `phases/` file.
To skip a phase: write only `skip: true`.
To add a phase the skeleton doesn't define: create a new file in
`phases/` with a description of when it runs relative to the core phases.
