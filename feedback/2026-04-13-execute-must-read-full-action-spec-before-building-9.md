> **NOTE (moved to outbox 2026-04-17):** This feedback was originally
> written to `.claude/memory/feedback/` in article-rewriter — a
> location the current orient skill flags as a wrong-write for CC
> upstream feedback. It was authored 2026-04-12 or 2026-04-13 (see
> frontmatter `date` below) but never delivered upstream because
> the assistant at that time could not invoke `/cc-feedback`. It's
> being moved to the global outbox now so CC can pick it up. **It may
> already have been addressed** in the 4–5 days since it was written;
> CC should verify current state before acting.

---

---
type: feedback
date: 2026-04-13
skills:
  - execute
severity: high
---

# Execute Must Read Full Action Spec Before Building

## What Happened

During execution of prj:88b9992a (Article Rewriter Web App), Phases
2b and 2c were marked complete with only a skeleton RewritePage. The
action notes contained detailed component specs — a morphing
nominalization animation, a useStream hook with stall detection, a
CSS Grid ComparisonView, PresetTabs, GlossaryDrawer, DownloadButtons,
StreamingOutput, print CSS, and an HTML export service. None of these
were built. The user had to call it out, and then call it out again
when the first fix was just adding loading spinners instead of the
actual planned components.

The action notes were too large to display inline from pib_query, so
they were saved to a file. The Phase 0 and Phase 1 notes were read
via an agent. The Phase 2 and 3 notes were also retrieved by an agent,
but were not actually read before building the frontend. Instead, the
frontend was built from general architectural knowledge (React +
Mantine + streaming), producing a monolithic RewritePage that had
none of the specified feedback, comparison, or interaction design.

## Root Cause

Two failures:

1. **Didn't read the spec before building.** The detailed Phase 2b/2c
   notes existed and had been retrieved, but were not consulted during
   implementation. The builder assumed they knew what was needed from
   the high-level action titles alone.

2. **Marked complete without verifying against acceptance criteria.**
   "It builds and the route exists" was treated as equivalent to "it
   matches the spec." No comparison was made between the action notes
   and the actual output.

## Suggested Fixes

### /execute skill — mandatory spec read

Before marking any action as in_progress, /execute MUST read the
action's full notes. If the notes are too large for inline display
(common for actions filed with junior-dev detail), spawn an agent to
retrieve them. Never build from the action title or summary alone.

### /execute skill — spec comparison before completion

Before marking any action complete, /execute should:
1. Re-read the action's notes (or the agent-retrieved version)
2. List every component, file, and acceptance criterion mentioned
3. Verify each one exists and matches the spec
4. Only then mark complete

This could be a prompt hook on action completion, or a built-in
step in the /execute skill.

### Promotion candidate

If this pattern recurs, promote to a hook that blocks pib_complete_action
unless a spec-comparison step has been performed in the current session.
