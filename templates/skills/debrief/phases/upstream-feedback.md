# Upstream Feedback — Surface CC Friction to the Source

**Position:** Runs after record-lessons (step 9), before skill discovery
(step 11). Lessons are fresh; friction is top of mind.

**This is an instruction phase** — it tells Claude what to do, not a
customization point for the project. It ships with CC and should not
be deleted or replaced with `skip: true`.

## What This Phase Does

During debrief, Claude already has full session context: what was built,
what went wrong, what was learned. This phase asks Claude to reflect on
one narrow question: **was there friction with anything CC provided?**

- A skill whose flow didn't match how the project actually works
- A phase file whose default behavior was wrong or confusing
- A convention that fought the project's grain
- A missing capability that required a workaround
- An unclear SKILL.md that led to wasted time

This is NOT the same as `/cc-extract` (which looks for generalizable
artifacts to upstream). This is field feedback — "this thing you shipped
hurt when I used it."

This phase also handles **pattern promotion** — surfacing project-level
cabinet patterns that look universal enough to promote upstream.

## Workflow

### 1. Claude Reflects (silent)

Review the session for CC-specific friction. Consider:

- Did any CC skill need to be worked around or used in an unintended way?
- Did a phase file's default behavior cause confusion or extra work?
- Was a SKILL.md unclear, leading to misinterpretation?
- Did the skeleton/phase separation feel wrong for something?
- Was something missing that would have helped?
- Did orient or debrief surface irrelevant information or miss something important?

If nothing comes to mind — **stop here silently**. Most sessions have
no CC friction. Do not prompt the user with "any CC feedback?" every
time. The phase produces nothing and costs nothing unless there's
something real.

### 2. Draft Feedback (if friction found)

For each friction point, draft a short feedback item:

```
## [Short title]

**Skill/phase:** [which CC component]
**Friction:** [what happened — 2-3 sentences max]
**Suggestion:** [what might be better — optional, can be "not sure"]
**Session context:** [one line about what the project was doing when this came up]
```

Keep it concrete. "The plan skill was confusing" is not useful.
"The plan skill's critique phase activated 4 cabinet members when only 1
was relevant, adding 3 minutes of noise to every plan" is useful.

### 3. Surface for Confirmation

Include the draft in the debrief report under a distinct heading:

> **Upstream feedback for CC:**
> I noticed friction with [component]. Here's what I'd send:
> [draft]
>
> Send this upstream? (yes / edit / skip)

The user confirms, edits, or dismisses. One quick decision per item.
Do not ask open-ended questions. Do not batch — if there are multiple
friction points (rare), present each separately.

### 4. Deliver

If the user confirms, deliver the feedback. Detection and delivery
follow the same pattern as `/cc-extract`:

**If linked** (the CC package resolves to a local directory — check
if `node -e "console.log(require.resolve('create-claude-cabinet'))"`
points to a local path rather than a `node_modules` path):

- Write the feedback as a markdown file in the CC repo's `feedback/`
  directory (create it if needed)
- Filename: `[source-project]-[date]-[short-title].md`
  (e.g., `flow-2026-04-04-plan-critique-noise.md`)
- Add frontmatter: `type: field-feedback`, `source: [project]`,
  `date: [ISO date]`, `component: [skill/phase name]`

**If not linked**, check whether `gh` is available and authenticated
(`gh auth status` exits 0). Then present the user with their options:

- **If `gh` works**, offer two choices:
  > "I can send this as a GitHub issue so the developer sees it
  > directly, or save it locally. Which do you prefer?"
  >
  > 1. Send as GitHub issue
  > 2. Save locally (I'll send it later or pass it along myself)

  If they choose GitHub:
  - Open a GitHub issue on `orenmagid/claude-cabinet`
  - Title: `Field feedback: [short title]`
  - Label: `field-feedback` (create if needed)
  - Body: the feedback markdown

- **If `gh` is not available** (most common for non-developers):
  > "I'll save this feedback locally for now. If you want, you can
  > pass it along to the developer yourself, or set up a free GitHub
  > account so future feedback goes directly to them. Here's a guide
  > if you're interested:
  > https://github.com/orenmagid/claude-cabinet/blob/main/GITHUB-SETUP.md
  > — totally optional. Your feedback is saved either way."

**For either local save path:**

- Append the feedback to `~/.claude/cc-feedback-outbox.json` as a
  JSON array entry with fields: `source` (project name), `date`,
  `component`, `title`, `body`, `status: "pending"`
- Create the file if it doesn't exist (initialize with `[]`)

**Flushing the outbox:** If a user later sets up `gh` and asks to
send saved feedback, read the outbox, post each `pending` entry as
a GitHub issue, and update its status to `"sent"` with the issue URL.

### 5. Check for Pattern Promotion Candidates

After handling CC friction feedback, check for cabinet member patterns
that should be promoted upstream.

**Scan `patterns-project.md` files:**

```bash
# Find all project-level pattern files
find .claude/skills/cabinet-*/patterns-project.md 2>/dev/null
```

For each file that exists, read it. For each pattern entry, evaluate:

- **Is it universal?** Would this pattern apply to any project using
  the same technology, or is it specific to this project's domain/codebase?
- **Is it mature?** Has it been observed 3+ times, or is it still early?
- **Is it already upstream?** Check the member's SKILL.md `## Historically
  Problematic Patterns` section — if it's already there, skip it.

**If a promotion candidate is found**, draft a feedback item:

```markdown
---
type: pattern-promotion
source: [project name]
date: [ISO date]
component: cabinet-[member-name]
---

## Pattern promotion: [pattern name]

**Cabinet member:** cabinet-[member-name]
**Pattern:** [description from patterns-project.md]
**Occurrences:** [count] across [count] audits
**Why it's universal:** [1 sentence — why this isn't project-specific]
```

Deliver via the same mechanism as friction feedback (step 4 above —
linked → write to CC `feedback/`, not linked → GitHub issue or outbox).

**Most sessions produce no promotion candidates.** Pattern promotion
is rare — it requires both a mature project-level pattern AND evidence
that the pattern is universal. Don't force it.

### 6. Done

Note in the debrief report what was sent and where. Move on to the
next phase.
