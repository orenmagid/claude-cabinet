---
type: field-feedback
source: theater-cheater
date: 2026-04-13
component: orient/context phase
---

## Orient skipped omega query — missed prior session deployment context

**Friction:** The orient skill instructions explicitly say to query omega for project-scoped context during the context phase. Claude skipped this entirely. Prior sessions had stored the deployment method and other decisions in omega, but none of that context was retrieved. This directly caused the `git push` failure — the information existed in omega but was never queried.

**Suggestion:** Orient's context phase could structurally enforce the omega query — e.g., the phase file outputs a required section header ("## Omega Context") that must be populated, rather than relying on Claude to remember to run the query. If omega is configured but the query is skipped, the briefing should show a warning.

**Session context:** Session start orientation for theater-cheater project.
