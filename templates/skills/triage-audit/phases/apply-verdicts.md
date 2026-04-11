# Apply Verdicts — Acting on Triage Decisions

Define how triage verdicts are applied. The /triage-audit skill reads
this file after receiving the user's verdicts.

When this file is absent or empty, the default behavior is: update
pib-db triage status, attempt auto-fix for fixable findings, create
actions for approved non-fixable findings. Fallback: write verdicts
to `triage.json`. To explicitly skip, write only `skip: true`.

## What to Include

Define your verdict application strategy:
- **Persistence** — where triage decisions are stored
- **Fix workflow** — what happens when a finding is approved for fixing
- **Action creation** — how approved findings become tracked work items
- **Suppression** — how rejected/deferred findings are excluded from
  future audits

## Default Behavior

**Access method:** Use `pib_*` MCP tools when available (see
`.claude/cabinet/pib-db-access.md`), fall back to `node scripts/pib-db.mjs`
CLI.

### Fix Verdicts
1. Update `triage_status = 'approved'` via `pib_triage` (or
   `node scripts/pib-db.mjs triage`)
2. If `autoFixable: true`:
   - Attempt the fix based on the finding's `suggestedFix`
   - Verify the fix (run relevant tests or checks)
   - If successful, update `triage_status = 'fixed'`
   - If failed, create an action instead
3. If not auto-fixable:
   - Create an action via `pib_create_action` (or
     `node scripts/pib-db.mjs create-action`)
   - Include finding details in action notes

### Defer Verdicts
1. Update `triage_status = 'deferred'` via `pib_triage` (or
   `node scripts/pib-db.mjs triage`)
2. Record reason in `triage_notes`
3. Finding suppressed in future audits via triage history

### Reject Verdicts
1. Update `triage_status = 'rejected'` via `pib_triage` (or
   `node scripts/pib-db.mjs triage`)
2. Record reason in `triage_notes`
3. Finding permanently suppressed in future audits

### Question Verdicts
1. Finding stays `triage_status = 'open'` — record question via
   `pib_triage` (or `node scripts/pib-db.mjs triage`)
2. Record question in `triage_notes`
3. Finding reappears in next triage

### Fallback (no pib-db)
Write verdicts to `reviews/<run-dir>/triage.json`:
```json
{
  "verdicts": [
    {
      "id": "finding-id",
      "cabinet_member": "...",
      "title": "...",
      "verdict": "fix|defer|reject",
      "notes": "user's reason or question"
    }
  ]
}
```

## Example Override

Uncomment and adapt for your project:

<!--
### External Work Tracker
Instead of creating actions in pib-db, create issues in your
project tracker:
```bash
gh issue create --title "Audit: ${finding.title}" \
  --body "${finding.description}" \
  --label "audit-finding"
```

### External Triage Storage
POST verdicts to an external API:
```bash
curl -X POST https://your-api.example.com/api/triage/verdicts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d @verdicts.json
```

### Custom Action Creation
Create actions with specific formatting, project assignment,
or area derivation logic based on your project's structure.
-->
