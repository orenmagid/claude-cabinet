# Finding Output — Persisting and Reporting Results

Define how to persist audit findings and present the results. The /audit
skill reads this file after all cabinet member agents have completed.

When this file is absent or empty, the default behavior is: write JSON
to a timestamped run directory, merge with `scripts/merge-findings.js`,
ingest to pib-db, and present a summary. To explicitly skip output,
write only `skip: true`.

## What to Include

Define your output strategy:
- **Storage** — where findings go (filesystem, database, API, all three)
- **Merge** — how per-cabinet-member outputs are combined
- **Reporting** — what to show the user and in what format
- **Next steps** — what to do after findings are persisted

## Default Behavior

1. **Create run directory:** `reviews/YYYY-MM-DD/HH-MM-SS/`
2. **Write cabinet member JSON:** One file per cabinet member in the run directory
3. **Merge findings:** Run `node scripts/merge-findings.js <run-dir>`
   to produce `run-summary.json` with deduplicated findings and metadata
4. **Ingest to database:** Run `node scripts/merge-findings.js <run-dir> --db`
   to also store findings in the reference data layer (pib-db). If pib-db
   is not initialized, findings are still saved as JSON files.
5. **Present summary:**
   - Total finding count and breakdown by severity
   - Findings by cabinet member
   - Any critical findings highlighted
   - Positive findings (healthy subsystems)
6. **Prompt for triage:** Remind the user that findings need human judgment.
   Use `/triage-audit` to review, approve, defer, or reject findings.

## Example Override

Uncomment and adapt if your project stores findings elsewhere:

<!--
### External API Storage
```bash
curl -X POST https://your-api.example.com/api/audit/findings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d @run-summary.json
```
Post findings to an external API instead of (or in addition to)
local storage. Useful when audit results need to be visible in
a dashboard or shared with a team.

### Custom Reporting
Instead of the default summary, generate a markdown report at
`reviews/YYYY-MM-DD/audit-report.md` with full finding details,
trend comparisons, and recommended priority order.
-->
