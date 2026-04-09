---
name: execute-plans
description: |
  Find open plans with surface area declarations, build conflict graph, execute
  non-conflicting plans in parallel via worktree agents. Use when: "execute plans",
  "run plans", "what can we build in parallel", "/execute-plans".
disable-model-invocation: true
related:
  - type: skill
    name: plan
  - type: skill
    name: execute
  - type: skill
    name: validate
  - type: script
    path: .claude/skills/execute-plans/scripts/build-conflict-graph.js
---

# /execute-plans — Parallel Plan Execution

## Purpose

Read open plans with surface area declarations, determine which can safely
run in parallel (based on file/directory overlap), and execute them via
worktree-isolated agents. This is the capstone planning skill — it turns
individual plans into coordinated parallel work.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration is generic. Your project defines specifics — where plans
come from, which files are known conflict sources, what to do after each
group merges — in phase files under `phases/`.

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
- `/validate` skill must be available (used between merges)
- Node.js available (for the conflict graph script)

## Workflow

### 1. Fetch Open Plans

Read `phases/fetch-plans.md` for where plans come from.

**Default (absent/empty):** Query pib-db for open actions that have
surface area declarations:

```bash
node scripts/pib-db.mjs query "
  SELECT a.fid, a.text, a.notes
  FROM actions a
  WHERE a.completed = 0 AND a.deleted_at IS NULL
    AND a.notes LIKE '%## Surface Area%'
  ORDER BY a.sort_order
"
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
echo '$ACTIONS_JSON' | node .claude/skills/execute-plans/scripts/build-conflict-graph.js
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

### 4. Present Execution Plan

Show the user:

```
Group 1 (can run in parallel):
  - act:abc123 "Build /validate skill" → .claude/skills/validate/
  - act:def456 "Add calendar view" → src/pages/

Group 2 (after Group 1 merges):
  - act:ghi789 "Refactor sidebar" → src/components/

Serial (conflicts with multiple groups):
  - act:jkl012 "Update shared config" → config.ts

Unschedulable (no surface area):
  - act:mno345 "Research caching strategies"
```

**Wait for explicit user approval before executing.**

### 5. Execute Each Group

For each group, in order:

#### a. Spawn Worktree Agents
For each plan in the group, use the Agent tool with `isolation: "worktree"`:
- Prompt: the action's full notes (the plan IS the prompt)
- Include: "Use the /execute skill's checkpoint protocol for implementation.
  After completing the implementation, run /validate"

#### b. Wait for Completion
All agents in the group run concurrently. Wait for all to finish.

#### c. Sequential Merge
For each completed worktree (one at a time):
1. Review the agent's changes (git diff)
2. Merge the worktree branch into main
3. Run `/validate` — all checks must pass
4. If validation fails: **stop**. Report the failure. Park the branch.
   Do not continue merging.

**Verify agents returned a worktree path** before counting them as done.
Agents can silently no-op if a plan's changes already exist on main.
Re-run agents that return no branch.

#### d. Report Results
After each group completes:
- Which plans succeeded
- Which failed and why
- What the codebase state is

### 6. Post-Group Actions

Read `phases/post-group.md` for what to do after each group merges.

**Skip (absent/empty).** Projects with deployment pipelines, CI checks,
or other post-merge steps define them here. Without this phase, execution
proceeds to the next group after validation passes.

### 7. Move to Next Group

Only proceed to the next group after the previous group is fully merged
and validated (and post-group actions complete, if defined).

### 8. Mark Plans Complete

Read `phases/completion.md` for how to mark plans as done after execution.

**Default (absent/empty):** Mark completed plans via pib-db:
```bash
node scripts/pib-db.mjs complete-action <fid>
```

Projects using external APIs or different work trackers define this phase.

## Error Handling

- **Agent fails**: Report the error, park the branch, continue with
  other agents in the group
- **Merge conflict**: Report the conflict, park the branch, suggest
  manual resolution
- **Validation fails after merge**: Revert the merge, park the branch,
  report what broke
- **All agents in a group fail**: Skip to next group, report failures

## Principles

- **Surface areas are the contract.** If a plan's surface area is
  wrong (touches files it didn't declare), that's a plan quality issue.
  The conflict graph is only as good as the declarations.
- **Conservative scheduling.** When in doubt, serialize. False conflicts
  just slow things down; missed conflicts cause merge failures.
- **User approves everything.** The execution plan, each group start,
  and any error recovery decisions.
- **Validate between every merge.** Never accumulate unvalidated merges.
- **File-level precision beats conceptual grouping.** Two plans that
  "feel independent" can still conflict if they both touch a shared
  file. The grouping algorithm works at the file level, not the feature
  level.

## Lessons Learned

These lessons come from real parallel execution runs:

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

4. **Worktree agents can silently no-op.** If a plan's changes already
   exist on main, the agent completes "successfully" but produces no
   worktree branch. Always verify agents returned a worktree path.

5. **Large-scale parallel execution works.** With accurate surface areas
   and a correct conflict graph, 13+ parallel worktree agents can run
   with zero merge conflicts. The file overlap matrix is the critical
   safety check.

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `fetch-plans.md` | Default: pib-db query for actions with surface areas | Where plans come from |
| `high-conflict-files.md` | Skip | Project-specific shared entry points |
| `post-group.md` | Skip | Post-merge actions (deploy, CI, etc.) |
| `completion.md` | Default: pib-db complete-action | How to mark plans done |

## Extending

To customize a phase: write content in the corresponding `phases/` file.
To skip a phase: write only `skip: true`.
To add a phase the skeleton doesn't define: create a new file in
`phases/` with a description of when it runs relative to the core phases.
