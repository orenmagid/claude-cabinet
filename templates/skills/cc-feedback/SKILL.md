---
name: cc-feedback
description: |
  File upstream feedback to Claude Cabinet mid-session. Reports friction
  with CC-provided skills, phases, or conventions without waiting for debrief.
  Use when: "cc-feedback", "feedback for CC", "file upstream feedback",
  "this CC skill is broken", "report CC friction".
---

# /cc-feedback — File Upstream Feedback

## Purpose

File feedback about Claude Cabinet friction at any point during a session.
The debrief upstream-feedback phase catches friction at session end, but
sometimes you hit a problem mid-session and want to report it immediately
before the context fades.

## Workflow

### 1. Gather Feedback

Ask the user what the friction is. If they already described it in their
message, skip to step 2.

Prompt: "What CC component gave you trouble, and what happened?"

### 2. Draft Feedback

Draft a feedback item from the user's description:

```markdown
---
type: field-feedback
source: [project name from package.json or directory name]
date: [ISO date]
component: [skill, phase, or convention name]
---

## [Short title]

**Friction:** [what happened — 2-3 sentences max]
**Suggestion:** [what might be better — optional]
**Session context:** [one line about what the project was doing]
```

Present the draft to the user:

> Here's what I'd send:
> [draft]
>
> Send this? (yes / edit / skip)

### 3. Deliver

If the user confirms, deliver using the standard upstream feedback
mechanism:

**If this IS the CC source repo** (check: `node -e "const p = require('./package.json'); process.exit(p.name === 'create-claude-cabinet' ? 0 : 1)"` exits 0):

- Write directly to the local `feedback/` directory (create if needed)
- Filename: `[source-project]-[date]-[short-title].md`
- This is the dogfood case — the project IS the upstream repo, so
  feedback goes directly into the local `feedback/` directory.

**Everything else** (consuming projects, whether linked or not):

Save to `~/.claude/cc-feedback-outbox.json` (create as `[]` if missing).
Append entry with fields: `source`, `date`, `component`, `title`, `body`,
`status: "pending"`, `delivered: false`.

The outbox is picked up by orient in the CC source repo next session
and delivered to `feedback/`. This avoids dirtying the CC repo's working
tree from consuming projects (which caused confusion when the linked
direct-write path was used).

If `gh` is available (`gh auth status` succeeds), also offer:
> Also send as a GitHub issue for faster visibility?

If yes: open issue on `orenmagid/claude-cabinet` with title
`Field feedback: [short title]` and label `field-feedback`.

### 4. Confirm

Tell the user where the feedback was delivered:
- "Feedback written to `feedback/[filename]` in the CC repo."
- "GitHub issue created: [URL]"
- "Saved to outbox. It'll be delivered when `gh` is set up."

## Important

- This skill does not auto-detect friction. The user explicitly invokes
  it. Keep the interaction tight — gather, draft, confirm, deliver.
- The debrief upstream-feedback phase still runs at session end and may
  catch friction the user didn't think to report manually.
- Do not batch multiple feedback items. One invocation = one item.
