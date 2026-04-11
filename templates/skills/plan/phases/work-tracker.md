# Work Tracker — How to File Work Items

Define how to file an approved plan as a work item in your project's
tracking system. The /plan skill reads this file after user approval.

When this file is absent or empty, the default behavior is: create an
action in the reference data layer (pib-db) with the plan summary in
notes. If pib-db is not initialized, note that work tracking is available
via `node scripts/pib-db.mjs init`.

## Default Behavior (pib-db)

**Access method:** Use `pib_*` MCP tools when available (see
`.claude/cabinet/pib-db-access.md`), fall back to `node scripts/pib-db.mjs`
CLI.

When no custom work tracker is configured, use `pib_create_action` (or
CLI fallback):

```bash
node scripts/pib-db.mjs create-action "Short imperative plan title" \
  --area "<area>" \
  --notes "## Problem\n...\n\n## Implementation\n..."
```

Derive the area from the plan's context. Include the full plan in the
action's notes so it's self-contained — the action IS the plan.

If the plan relates to an existing project in pib-db, include
`--project <project-fid>` to link them.

If pib-db doesn't exist, note: "Work tracking available — run
`node scripts/pib-db.mjs init` to set up. Plan saved in conversation
only."

## What to Include

- **How to create items** — the API call, CLI command, or file operation
- **Required fields** — what metadata to include (area, project, priority)
- **How to determine fields** — where to look up the correct values
- **Confirmation** — what to report back after creating

## Example Work Tracker Configurations

Uncomment and adapt these for your project:

<!--
### Database API
```bash
curl -X POST https://your-app.example.com/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "text": "Short imperative description",
    "area": "<area>",
    "projectId": "<project-id>",
    "notes": "## Problem\n...\n\n## Implementation\n..."
  }'
```
Look up the correct area from the project:
```bash
sqlite3 project.db "SELECT area FROM projects WHERE id = '...'"
```

### GitHub Issues
```bash
gh issue create --title "Plan: short description" \
  --body "$(cat <<'EOF'
## Problem
...

## Implementation
...

## Surface Area
...

## Acceptance Criteria
...
EOF
)" --label "plan"
```

### Markdown File
Write the plan to a tasks file:
```markdown
## [Plan Title] — YYYY-MM-DD
Status: planned

[full plan content]
```

### Report Back
After creating, present:
- Item ID/link
- Project/area it was filed under
- Status
- Any open questions deferred
-->
