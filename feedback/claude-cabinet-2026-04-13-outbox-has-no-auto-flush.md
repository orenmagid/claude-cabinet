---
type: field-feedback
source: claude-cabinet
date: 2026-04-13
component: debrief/upstream-feedback phase
---

## Feedback outbox has no automatic flush — items accumulate silently

**Friction:** When consuming projects aren't linked (can't resolve
create-claude-cabinet to a local path), the upstream-feedback phase
writes to `~/.claude/cc-feedback-outbox.json` as a fallback. But
nothing reads or flushes the outbox automatically. 8 feedback items
accumulated across 3 projects (theater-cheater, article-rewriter, flow)
without ever reaching the CC repo's `feedback/` directory. The CC
maintainer only discovered them by manually checking the file.

**Suggestion:** Orient's context phase in the CC source repo should
check the outbox as part of its feedback scan. If pending items exist,
flush them to `feedback/` and mark them delivered. This closes the loop
— consuming projects write to the outbox, CC orient reads from it.
Alternatively, orient in any CC-installed project could flush when
it detects the outbox has pending items and the CC source repo path
is known (from cc-registry.json).

**Session context:** Orient briefing for CC source repo. Found 8
pending items in outbox that should have been in feedback/.
