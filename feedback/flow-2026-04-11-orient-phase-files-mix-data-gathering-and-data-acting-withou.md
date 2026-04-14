---
type: field-feedback
source: flow
date: 2026-04-11
component: orient/phases (skeleton pattern)
---

## Orient phase files mix data-gathering and data-acting without structural enforcement

**Friction:** A single phase file (auto-maintenance.md) contains both "query the DB for pending items" and "process each result via API calls." During orient execution, the gathering steps ran (12+ parallel queries) but the acting steps were silently skipped — the model treated querying as processing. The user's articulation answers sat unprocessed despite being fetched. We fixed it with stronger language ("BLOCKING — querying is not processing") but this is a compliance-layer fix (~60-80%).

**Suggestion:** The phase system could support declaring sub-steps as `blocking` — a structural hint that results from a gather step must be acted on before the phase can proceed. Something like frontmatter in the phase file (`blocking-steps: [1]`) or a convention where phases split into `gather` and `act` sections with an explicit gate between them. This would give the skeleton a way to enforce sequential execution within phases without requiring each project to write "DO NOT SKIP THIS" in prose.

**Session context:** Flow's orient auto-maintenance phase has 5 sweeps (commands, articulation, prep scout, auto-execute, docs check). The articulation sweep has a blocking Step 1 (process user answers) that was skipped.
