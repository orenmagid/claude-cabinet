---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-30
component: Workflow tool / worktree isolation
---

## Workflow prompts can silently contradict CLAUDE.md in worktree agents

**Friction:** Ran a 7-agent parallel workflow with `isolation: 'worktree'`. Each agent invoked `/execute` for a pib-db action. The project's CLAUDE.md says "no local Ruby 3.3.11; use docker-compose exec" — a hard constraint. But my workflow prompt said "Docker-compose may not work in a worktree" because I wasn't sure about volume mounts. Two agents followed my prompt over CLAUDE.md, spent hours trying to verify with local Ruby 2.6, and got stuck. The other 5 agents that didn't need test verification completed fine.

The root issue: workflow prompts are written by the orchestrating Claude, not the user, and there's no guardrail preventing the prompt from contradicting load-bearing CLAUDE.md constraints. Worktree agents DO inherit CLAUDE.md (it's in the repo), but an explicit instruction in the agent prompt takes priority.

**Suggestion:** Consider adding guidance to the Workflow tool documentation: "Worktree agents inherit the project's CLAUDE.md. Do not contradict it in your prompt — if CLAUDE.md says 'use docker-compose', don't hedge with 'docker may not work in worktrees.' When uncertain about worktree behavior, omit the claim rather than guessing wrong." Alternatively, a warning when a workflow prompt contains language that conflicts with known CLAUDE.md constraints would catch this class of error.

**Session context:** Mass-arbitration Rails 8 platform. 7 parallel worktree agents executing pib-db actions overnight. 5 succeeded, 2 stuck for hours on Ruby version mismatch.
