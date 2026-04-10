---
type: field-feedback
source: article-rewriter
date: 2026-04-09
component: scripts/pib-db.mjs, create-action CLI
---

## create-action CLI doesn't document --projectFid, easy to misuse

**Friction:** The `create-action` usage string says:

```
create-action "text" [--area X]
```

But the actual function signature accepts `--projectFid` to link an action
to a project — the most common use case. Because `--projectFid` isn't shown
in the help text, I guessed the interface was positional:
`create-action <projectFid> <text>`. This created 9 broken actions where
the text was set to the project FID and no project link was established.

**What would have prevented the mistake:**
1. The help text should list all flags: `create-action "text" [--projectFid X] [--area X] [--due X]`
2. Even better: accept project as a positional arg since linking to a project
   is the primary use case: `create-action <projectFid> "text" [--area X]`
3. Validation: if the text looks like a FID (`prj:...`), warn that it's
   probably meant to be the project, not the text

**Suggestion:** Update the help string to show all accepted flags. Consider
making projectFid the first positional arg since most actions belong to a
project.
