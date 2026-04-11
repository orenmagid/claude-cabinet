---
type: field-feedback
source: claude-cabinet
date: 2026-04-11
component: skills/plan/SKILL.md
---

## Plan skill does not enforce Surface Area section format

**Friction:** The plan skill's validation step 6b checks "Surface area
completeness" but does not enforce that the filed action notes contain a
`## Surface Area` section with the standard `- files:` / `- dirs:` format.
All 5 actions in the Platform Feature Adoption project were filed with
`### Files` sections (Created/Modified lists) instead, which the
execute-plans skill cannot parse. Had to manually patch all 4 eligible
actions before parallel execution could proceed.

**Suggestion:** The plan skill's filing step should validate that the
notes contain a `## Surface Area` section with parseable `- files:` and
`- dirs:` lines before writing to pib-db. Reject and re-format if the
section uses a non-standard format. Even better: the future pib-db MCP
server (WS5) could enforce this structurally at the API layer.

**Session context:** Starting Platform Feature Adoption project, trying
to use /execute-plans for parallel execution of 5 work streams.
