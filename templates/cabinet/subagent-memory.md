# Cabinet-Member Subagent Memory

Some cabinet members benefit from persistent memory across sessions —
they remember things that only they need to recall (e.g., historian
remembers prior decisions across projects; record-keeper remembers
the last-known-good state of project docs). Claude Code provides
subagent memory natively via a single frontmatter field.

## How it works (platform-provided)

Per Claude Code's [subagent docs](https://code.claude.com/docs/en/sub-agents),
adding `memory: <scope>` to a subagent's frontmatter:

1. **Auto-loads** the subagent's memory directory into its context.
2. **Auto-injects** read/write instructions into its system prompt.
3. **Auto-enables** Read / Write / Edit tools for the agent.
4. Persists across sessions — the subagent re-reads its memory on
   each invocation.

CC just declares the field. No CC-side wiring, no helper modules,
no hook integrations. The platform does the heavy lifting.

## Scopes

| Scope | Memory location | Use when |
|---|---|---|
| `user` | `~/.claude/agent-memory/<agent-name>/` | The agent's knowledge is cross-project (works the same in any project on this machine). |
| `project` | `<project>/.claude/agent-memory/<agent-name>/` | The agent's knowledge is project-specific (different per repository). |
| `local` | `<project>/.claude/agent-memory-local/<agent-name>/` | Project-specific AND not committed to git (developer-local). |

## Cabinet members with persistent memory

CC ships persistent memory on 6 cabinet members where it's clearly
valuable. The other 25 do not declare `memory:` — they use parent
session context only (no subagent-specific persistence).

| Member | Scope | Why |
|---|---|---|
| `cabinet-historian` | `user` | Institutional memory custodian; cross-project view by design. Remembers pattern precedents that apply across projects. |
| `cabinet-vision` | `user` | Cross-project strategic patterns; "what's emerging in this space" is a personal-machine fact more than a per-repo fact. |
| `cabinet-record-keeper` | `project` | Doc accuracy tracking is per-project. Remembers what each CLAUDE.md / briefing / status doc claimed last time and whether the code has since drifted. |
| `cabinet-technical-debt` | `project` | Per-project debt patterns. Remembers which areas have accumulated debt previously, which patterns recur. |
| `cabinet-goal-alignment` | `project` | Per-project mission tracking. Remembers what the project said it was for, surfaces drift over time. |
| `cabinet-anti-confirmation` | `project` | Remembers prior challenges raised in this project, so the same dissenting view doesn't have to be re-derived from scratch each session. |

## When NOT to add `memory:`

- The cabinet member's analysis is fully reconstructible from current
  code + briefings each session (e.g., `cabinet-security` reads the
  code and reports — nothing carried over).
- The member is invoked rarely enough that re-deriving is cheaper
  than maintaining memory accuracy.
- The member's output is meant to be ephemeral by design (e.g.,
  `cabinet-anti-confirmation` was on the fence — its memory could
  reinforce its own past biases rather than challenging them. We
  chose `project` scope on the bet that remembering prior challenges
  is more valuable than the risk of bias-reinforcement; re-evaluate
  if we see drift).

## Inspecting subagent memory

```bash
# user-scoped memory for cabinet-historian:
ls -la ~/.claude/agent-memory/cabinet-historian/

# project-scoped memory for cabinet-record-keeper (in current project):
ls -la .claude/agent-memory/cabinet-record-keeper/
```

Each file is plain markdown. Read or edit by hand if you want to
correct what the agent remembered.

## Pruning subagent memory

There's no separate pruning command — these are just markdown files.
Delete files you no longer want; the agent stops referencing them.
Edit files to correct content. If a subagent's memory becomes noisy
or wrong-headed, the cleanest reset is to delete its agent-memory
directory entirely. It will start fresh on next invocation.

## Adding `memory:` to a new cabinet member

1. Decide the scope: `user` (cross-project) or `project` (per-repo).
2. Add `memory: <scope>` to the frontmatter, typically after
   `user-invocable:`.
3. That's it. The platform handles the rest on next invocation.

Optional: add a sentence to the member's SKILL.md mentioning that it
has persistent memory at `<agent-memory-path>` so the user knows
where to look if they want to inspect or edit.
