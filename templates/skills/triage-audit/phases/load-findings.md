# Load Findings — Where to Get Findings for Triage

Define where the triage skill loads audit findings from. The /triage-audit
skill reads this file before presenting findings.

When this file is absent or empty, the default behavior is: query pib-db
for findings with `triage_status = 'open'` using `pib_query` MCP tool
(or `node scripts/pib-db.mjs query` CLI fallback), fall back to the most
recent `reviews/*/run-summary.json`. To explicitly skip, write only
`skip: true`.

## What to Include

Define your finding source:
- **Primary source** — where findings live (database, API, filesystem)
- **Fallback** — what to do if the primary source is unavailable
- **Filtering** — which findings to include (all open, specific run, etc.)

## Example Override

Uncomment and adapt if your project stores findings elsewhere:

<!--
### External API
```bash
curl -s https://your-api.example.com/api/audit/findings?status=open \
  -H "Authorization: Bearer $API_TOKEN"
```
Returns JSON array of findings in the same format as run-summary.json.

### Specific Run
Load findings from a specific audit run instead of all open findings.
Use `pib_query` (or `node scripts/pib-db.mjs query` CLI fallback):
```sql
SELECT * FROM audit_findings WHERE run_id = 'run-2026-04-01'
```

### Multiple Sources
Merge findings from pib-db (local) and an external API (team findings)
before presenting for triage.
-->
