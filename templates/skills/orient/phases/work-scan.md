# Work Scan — What Work Items to Check

Define what work items to scan so orient can surface what needs attention.
This is what connects orientation to action — without it, orient can
only report on project state, not on what needs doing.

When this file is absent or empty, the default behavior is: query the
reference data layer (pib-db) for open actions and projects. If pib-db
is not initialized, skip gracefully with a note that work tracking is
available via `node scripts/pib-db.mjs init`.

## Default Behavior (pib-db)

When no custom work-scan is configured, query pib-db:

```bash
# Open actions (overdue first, then due today, then flagged, then recent)
node scripts/pib-db.mjs list-actions

# Active projects with open action counts
node scripts/pib-db.mjs list-projects
```

Present grouped by urgency:
- **Overdue** — actions with `due` before today
- **Due today** — actions with `due` = today
- **Flagged** — actions with `flagged = 1`
- **Recent** — actions created in the last 7 days

If pib-db doesn't exist (file not found), skip with: "Work tracking
available — run `node scripts/pib-db.mjs init` to set up."

## What to Include

For each work source, provide:
- **What** — the query or command to find open work
- **What it surfaces** — overdue items, due today, flagged/urgent, blocked
- **Format** — how to present results (counts, lists, grouped)

## Example Work Scans

Uncomment and adapt these for your project:

<!--
### Task Backlog
```bash
sqlite3 project.db "SELECT id, text, status, due_date FROM tasks WHERE status != 'done' ORDER BY due_date"
```
All open tasks. Group by: overdue, due today, due this week, no date.

### Inbox / Queue
```bash
sqlite3 project.db "SELECT COUNT(*) FROM inbox WHERE processed = 0"
```
Unprocessed items that arrived since last session. Report count; details
come during processing.

### Issue Tracker
```bash
gh issue list --state open --assignee @me --json number,title,labels
```
Open issues assigned to the user. Flag any marked urgent or blocking.

### Markdown Task Lists
```bash
grep -r '- \[ \]' docs/todo.md
```
If work is tracked in markdown files, scan for unchecked items.
-->
