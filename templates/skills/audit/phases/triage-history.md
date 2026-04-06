# Triage History — Loading Suppression Lists

Define how to load previously-triaged findings so the audit doesn't
regenerate findings the user already dismissed. The /audit skill reads
this file before spawning cabinet member agents.

When this file is absent or empty, the default behavior is: run
`scripts/load-triage-history.js` which tries the reference data layer
(pib-db) first, then falls back to scanning `reviews/*/triage.json`
files. To explicitly skip suppression (regenerate all findings fresh),
write only `skip: true`.

## What to Include

Define your suppression strategy:
- **Source** — where triage decisions are stored
- **Format** — what the suppression list looks like
- **Scope** — how far back to look (all time, last 30 days, etc.)

## How Suppression Works

The suppression list contains:
- **Rejected IDs** — findings explicitly marked as not-a-problem
- **Rejected fingerprints** — cabinet member + title pairs for fuzzy matching
  (catches regenerated findings with new IDs but same content)
- **Deferred IDs** — findings postponed for later review
- **Deferred fingerprints** — same fuzzy matching for deferred items

Each cabinet member agent receives the full suppression list and skips
findings that match. This prevents the triage queue from filling with
previously-dismissed items.

## Example Override

Uncomment and adapt if your project stores triage decisions elsewhere:

<!--
### External Triage API
```bash
curl -s https://your-api.example.com/api/triage/suppression \
  -H "Authorization: Bearer $API_TOKEN"
```
Returns JSON in the same format as load-triage-history.js output:
{ rejectedIds, rejectedFingerprints, deferredIds, deferredFingerprints }
-->
