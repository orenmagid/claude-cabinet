---
name: cc-feedback
description: |
  File upstream feedback to Claude Cabinet mid-session. Reports friction
  with CC-provided skills, phases, or conventions without waiting for debrief.
  Use when: "cc-feedback", "feedback for CC", "file upstream feedback",
  "this CC skill is broken", "report CC friction".
disable-model-invocation: 'true'
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

**If linked** (CC package resolves to a local directory — check if
`node -e "console.log(require.resolve('create-claude-cabinet'))"` points
to a local path rather than `node_modules`):

- Write to the CC repo's `feedback/` directory
- Filename: `[source-project]-[date]-[short-title].md`

**If not linked**, check whether `gh` is available (`gh auth status`):

- **If `gh` works**, offer the choice:
  > Send as a GitHub issue, or save locally?
  > 1. GitHub issue (developer sees it directly)
  > 2. Save locally

  If GitHub: open issue on `orenmagid/claude-cabinet` with title
  `Field feedback: [short title]` and label `field-feedback`.

- **If no `gh`**: save to `~/.claude/cc-feedback-outbox.json` (create
  as `[]` if missing). Append entry with fields: `source`, `date`,
  `component`, `title`, `body`, `status: "pending"`.

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
