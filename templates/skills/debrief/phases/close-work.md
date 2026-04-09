# Close Work — Match, Close, and Resolve

Define how to match the session's work against open items and close them.
This includes marking tasks done, resolving feedback, and updating any
tracking system. The /debrief skill reads this file after inventorying
what was done.

When this file is absent or empty, the default behavior is: query the
reference data layer (pib-db) for open actions, match against the
session's git log, and propose marking matched actions as done. If
pib-db is not initialized, skip gracefully.

## Default Behavior (pib-db)

When no custom close-work is configured:

1. **Get session work:** Review `git log --oneline` for this session's
   commits (since session start or last 2 hours)
2. **Get open actions:** `node scripts/pib-db.mjs list-actions`
3. **Match:** For each open action, check if this session's work
   addresses it (compare action text/notes against commit messages
   and changed files)
4. **Propose:** Present matched actions and ask the user to confirm
   which to close
5. **Close confirmed:** `node scripts/pib-db.mjs complete-action <fid>`

If pib-db doesn't exist, skip with a note.

## What to Include

- **How to query open items** — where your work tracker lives, how to
  read it
- **How to mark items done** — the command or API to update status
- **How to resolve feedback** — if your project tracks feedback or
  comments, how to mark them addressed
- **What to include in completion notes** — commit references, summary
  of what was built

## Example Close-Work Patterns

Uncomment and adapt these for your project:

<!--
### Task Tracker (Database)
```bash
# Query open tasks
sqlite3 project.db "SELECT id, text, status FROM tasks WHERE status != 'done'"

# Mark a task done with commit reference
COMMIT=$(git log -1 --format=%h)
sqlite3 project.db "UPDATE tasks SET status = 'done', notes = notes || '\n\nCompleted in $COMMIT' WHERE id = 'TASK_ID'"
```

### Task Tracker (API)
```bash
# Query open tasks
curl -s https://your-api.example.com/api/tasks?status=open

# Mark done
curl -X PATCH https://your-api.example.com/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "done", "completedRef": "COMMIT_HASH"}'
```

### Task Tracker (Markdown)
```bash
# Find open tasks
grep -n '- \[ \]' tasks.md

# Mark done (replace checkbox)
# Edit the file to change `- [ ]` to `- [x]` for completed items
```

### Feedback / Comments
```bash
# Query unresolved feedback
sqlite3 project.db "SELECT id, text FROM feedback WHERE resolved = 0"

# Cross-reference against session work — if the feedback was addressed,
# resolve it with a note about what fixed it
sqlite3 project.db "UPDATE feedback SET resolved = 1, resolution = 'Fixed in COMMIT' WHERE id = FEEDBACK_ID"
```

### Follow-On Work
When closing an item that has documented sub-phases or next steps in its
notes, create new items for each. Known work that lives only in completed
items' notes will be forgotten. There is no "later" — create it now.
-->

## Project Completion Scan

After closing individual actions, check for projects that may be ready
to complete. A project with actions where all are done is finished —
leaving it active is stale state that erodes trust in the work tracker.

When using pib-db (default):

```bash
node scripts/pib-db.mjs query "
  SELECT p.fid, p.name,
    (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid) as total,
    (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid AND a.completed = 1) as done
  FROM projects p
  WHERE p.status = 'active'
    AND p.deleted_at IS NULL
    AND (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid) > 0
    AND (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid AND a.completed = 0 AND a.deleted_at IS NULL) = 0
"
```

For each result: all actions are complete. Propose completing the project:
- Show the project name and action count (e.g., "prj:abc — My Project (5/5 actions done)")
- Ask the user to confirm before closing
- On confirmation: `node scripts/pib-db.mjs query "UPDATE projects SET status = 'done', completed_at = date('now') WHERE fid = '<fid>'"`

**Design notes:**
- Projects with zero total actions are excluded — they may be containers
  or newly created, not "done."
- This runs AFTER individual action closing, so newly-completed actions
  from this session are counted.
- If pib-db doesn't exist, skip this check.
