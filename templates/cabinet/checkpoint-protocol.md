# Cabinet Checkpoint Protocol

The single source of truth for how cabinet members review work in
progress. `/execute` and `/execute-group` both **read this file and
follow it** rather than copying the mechanism — so a change here flows to
every checkpoint, everywhere, with no copy-drift.

A checkpoint is a chance to stop before the cost of fixing goes up. The
mechanism is the same at every scale; only the **scope** of what's
reviewed changes.

## When you are told to "follow the checkpoint protocol scoped to X"

The caller names a scope. The scope determines what each spawned agent
reviews — everything else (how to spawn, what to collect, how to
escalate) is identical.

| Scope | Reviews | Runs |
|-------|---------|------|
| `pre-impl` | The plan text + the list of files it will change | Before any code is written |
| `this file group` | The git diff for one logical group of changed files | After each file group is implemented |
| `pre-commit` | The full git diff of all changes | After implementation, before commit |
| `this group's aggregate` *(group runs only)* | The combined diff of all plans in a parallel group | After a parallel group merges |

A *parallel group* (the last row) is `/execute-group`'s unit of work: a
set of conflict-free plans implemented concurrently in separate worktrees,
then merged together. `/execute` never exercises that scope — it runs one
plan at a time and uses only the first three.

## Step 1 — Select which members to spawn

Spawn one Agent per cabinet member that matches **either**:

- **Standing mandate** — `standingMandate` includes the current verb
  (`execute`). Read `.claude/skills/_index.json` to find them. These run
  at every checkpoint regardless of surface area.
- **Surface area** — a file in the reviewed scope matches the member's
  file patterns, or a keyword in the plan description matches the
  member's topic keywords.

Fall back to reading `cabinet-*/SKILL.md` frontmatter if the index is
missing.

**Err toward inclusion.** A member that activates unnecessarily costs a
few seconds; one that stays silent when it was needed costs rework. For
`this file group` scope, narrow to members matching *that group's* files
— a member reviewing 3 changed files gives sharper feedback than one
reviewing 30.

If the project has no cabinet members, skip the checkpoint and proceed —
checkpoints add depth, not structure.

## Step 2 — Spawn the agents (concurrently)

Spawn the selected members concurrently — they don't depend on each
other. **How** you spawn depends on the caller:

- From `/execute` (main session): issue all Agent-tool calls in a single
  message so they run in parallel.
- From `/execute-group` (workflow script): issue the spawns as `agent()`
  calls inside a `parallel()` block. Worktree agents cannot spawn
  reviewers themselves — the workflow orchestrator does it.

Either way, each spawned agent receives:

- The cabinet member's full `SKILL.md` content
- Essential project briefing from `.claude/cabinet/_briefing.md` (read it
  once, reuse for every agent)
- The member's `directives.execute`, if present — paste it in to sharpen
  the member's focus
- **The scoped material:** plan text + file list (`pre-impl`), or the
  relevant git diff (`this file group`, `pre-commit`, aggregate)
- An instruction to return the verdict object below

**Plan-first review discipline (critical for `pre-impl` scope):** at
`pre-impl` scope, the agent receives the plan's full notes. The plan IS
the primary input — it may already address common risks (auth, validation,
XSS, race conditions). The agent MUST:

1. **Read the plan text first.** Understand what the plan says it will do
   and what mitigations it already includes.
2. **Only raise concerns the plan does NOT address.** If the plan says
   "preview action lives in Admin::TargetsController with three-layered
   auth," do not raise "needs admin auth" as a concern — the plan already
   covers it. Explicitly acknowledge addressed concerns rather than
   re-raising them.
3. **Distinguish "the codebase has this risk" from "the plan doesn't
   mitigate this risk."** A checkpoint is not a codebase audit. The
   question is whether THIS PLAN is safe to start — not whether the
   codebase has pre-existing issues outside the plan's scope.

Without this discipline, cabinet members pattern-match against codebase
state and raise false positives that the plan already handles, wasting
tokens on re-runs that produce the same concerns.

## Step 3 — Collect verdicts

Each agent returns exactly this shape:

```json
{
  "cabinet_member": "name",
  "verdict": "continue" | "pause" | "stop",
  "concerns": [
    { "description": "...", "evidence": "...", "severity": "blocking" | "advisory" }
  ]
}
```

## Step 4 — Apply escalation

Collect every verdict, then:

- **Any `stop`** → halt. Show the concern. Require an explicit override
  from the user before proceeding.
- **Any `pause`** → show the concern with options: proceed / address /
  abort.
- **3+ `pause`** → escalate to stop-equivalent (halt, require override).
- **All `continue`** → proceed with a brief one-line summary.

At `pre-commit` and aggregate scopes, re-check earlier `continue`
concerns: a concern that was minor in one file group can become
significant once all changes are viewed together.

## Principles

- **Cabinet members are guardrails, not gates.** The user always has the
  final say. A `stop` requires explicit override — it is not an automatic
  rejection.
- **Scope tightly.** The narrower the diff a member reviews, the better
  the feedback.
- **The pre-commit sweep catches emergent issues.** File groups that look
  fine alone create problems in combination — type mismatches across
  boundaries, security gaps from API + frontend changes landing together.
