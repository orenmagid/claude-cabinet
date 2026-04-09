# Overlap Check — Search for Existing Work

Define how to search your project's work tracker for items that overlap
with proposed work. The /plan skill reads this file before drafting to
prevent duplicate plans.

When this file is absent or empty, the default behavior is: query the
reference data layer (pib-db) for open actions with similar text to the
proposed work. If pib-db is not initialized, skip gracefully.

## Default Behavior (pib-db)

When no custom overlap check is configured:

```bash
# Search open actions for keywords related to the proposed work
node scripts/pib-db.mjs query "SELECT fid, text, substr(notes, 1, 200) as notes_preview FROM actions WHERE completed = 0 AND deleted_at IS NULL AND (text LIKE '%keyword%' OR notes LIKE '%keyword%')"
```

Search with multiple keywords derived from the proposed plan's problem
description. Surface any matches: "Found N open actions that may overlap
with this plan" — then list them so the user can decide whether to
proceed, merge, or defer.

If pib-db doesn't exist, skip with a note.

## What to Include

- **How to query** — the command, API call, or file to search
- **What to search** — open items, recently closed items, deferred items
- **Keywords** — search with multiple relevant terms, not just one

## Example Overlap Check Patterns

Uncomment and adapt these for your project:

<!--
### Database Tracker
```bash
sqlite3 project.db "SELECT id, text, substr(notes, 1, 200) FROM tasks WHERE completed = 0 AND (text LIKE '%keyword%' OR notes LIKE '%keyword%')"
```
Search with multiple keywords relevant to the problem space.

### GitHub Issues
```bash
gh issue list --state open --search "keyword" --json number,title,labels
gh issue list --state closed --search "keyword" --limit 5 --json number,title
```
Check both open and recently closed issues — someone may have already
solved this or started and abandoned it.

### Markdown Backlog
```bash
grep -i "keyword" backlog.md tasks.md TODO.md
```
Search across all task-tracking files.

### Linear / Jira / External Tracker
```bash
curl -s "https://api.example.com/issues?q=keyword" -H "Authorization: Bearer $TOKEN"
```
-->
