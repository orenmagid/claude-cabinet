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
  - cc-feedback
severity: moderate
scope: CC-wide
---

# /cc-feedback cannot be invoked by the assistant

## What Happened

User asked the assistant to file cc-feedback items. The assistant
tried `Skill("cc-feedback")` and got:

> Skill cc-feedback cannot be used with Skill tool due to
> disable-model-invocation

The assistant then manually wrote feedback files to
`.claude/memory/feedback/` in the correct format, which works but
bypasses whatever `/cc-feedback` does beyond file creation (routing
logic, outbox, GitHub issue filing, etc.).

## Root Cause

`/cc-feedback` has `disable-model-invocation` set in its skill
config. This means only the human can type `/cc-feedback` in the
CLI — the assistant cannot invoke it programmatically, even when
the human explicitly asks it to.

## Suggested Fixes

1. **Remove `disable-model-invocation` from cc-feedback.** The user
   saying "file cc-feedback" is a clear delegation intent. If the
   skill is safe for the human to run, it should be safe for the
   assistant to run on the human's behalf.

2. **If there's a reason it's gated** (e.g., interactive prompts,
   destructive side effects), document that reason so the assistant
   can explain it instead of just failing with a cryptic error.

3. **At minimum:** When the assistant can't invoke a skill, the
   error message should say what to do instead — e.g., "Run
   `/cc-feedback` directly in the CLI" — not just state the
   restriction.
