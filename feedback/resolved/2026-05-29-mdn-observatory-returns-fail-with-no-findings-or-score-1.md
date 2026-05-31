---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-29
component: cc-site-audit
---

## MDN Observatory returns fail with no findings or score

**Friction:** MDN HTTP Observatory shows `status: fail` for both sites
in a comparison run, but returns zero findings, no score, and no grade.
The JSON has empty findings arrays and null for score/grade. The terminal
output just shows `[!] MDN HTTP Observatory` with no details. Both sites
ran (7s and 3.3s durations) so the API was hit — the response just
wasn't parsed into actionable findings.

**Suggestion:** Either parse the Observatory API response into scored
findings (it returns per-header grades), or if the API response format
has changed, surface the raw grade/score. A check that always returns
"fail" with no detail is worse than skipping — it looks broken.

**Session context:** Site-audit comparison of feeshame.com vs. staging
app on Railway. Every other check returned usable findings.
