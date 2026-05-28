---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-28
component: debrief (step 3 — cabinet consultations)
---

## Debrief silently skips cabinet consultations due to _index.json parse failure

**Friction:** The debrief skeleton step 3 says to read .claude/skills/_index.json and filter for standingMandate includes "debrief". Claude ad-hoc parsing tried the index as a flat dict and a flat list, but the actual schema is `{"skills": [...]}` — an object with a "skills" key containing an array of objects. The parse returned no matches, so the phase silently skipped. Three members (record-keeper, historian, system-advocate) all have debrief mandates and were missed. The user caught it.

**Suggestion:** The debrief SKILL.md should document the actual _index.json schema (`{"skills": [{name, standingMandate, directives, ...}, ...]}`) so Claude does not have to guess the structure. Alternatively, provide a one-liner parse command (e.g., `node -e "..."`) that Claude can copy verbatim instead of writing ad-hoc JSON parsing each time.

**Distinct from:** `2026-04-17-debrief-cabinet-consultations-phase-silently-skipped-under-s-19.md` (that was about skipping under fatigue; this is about the schema being undocumented causing a silent parse failure).

**Session context:** Debriefing after deploying the feeshame.com SEO/parity work to Railway staging. The silent skip meant no record-keeper doc-staleness check, no historian memory verification, and no system-advocate ledger update would have run — exactly the failure mode the SKILL.md warns about.
