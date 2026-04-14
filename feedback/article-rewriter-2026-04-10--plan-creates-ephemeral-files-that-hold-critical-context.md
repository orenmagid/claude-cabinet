---
type: field-feedback
source: article-rewriter
date: 2026-04-10
component: plan skill
---

## /plan creates ephemeral files that hold critical context

**Friction:** The /plan skill writes a plan file to `.claude/plans/` that it documents as ephemeral ("they get overwritten next time anyone enters plan mode"). But during planning, this file accumulates the most detailed output — design decisions, surface area, acceptance criteria, cabinet critique. The guardrail text says "All architectural context MUST be persisted to the work item," but that's a prompt-level compliance (~60-80%) rule for something that needs structural enforcement. In practice, Claude wrote the full plan to the file and only filed to pib-db when the user pointed out the mistake.

**Suggestion:** The skill workflow should structurally ensure plan content flows into the durable work tracker. Options: (a) skip the plan file entirely and draft directly into pib-db project notes + action notes, (b) use the file as a scratchpad but make the final step "move content to work tracker and delete file" with the delete as the enforcement, or (c) make the plan file the durable artifact (not ephemeral) so the "overwritten" warning is wrong and gets removed. The current approach — write to ephemeral file, hope Claude remembers to also file to pib-db — is an entropy trap.

**Session context:** Planning the first domain extension (medico-legal mode) for the article rewriter plugin.
