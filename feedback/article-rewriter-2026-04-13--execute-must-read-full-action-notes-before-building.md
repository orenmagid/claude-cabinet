---
type: field-feedback
source: article-rewriter
date: 2026-04-13
component: execute
---

## /execute must read full action notes before building

**Friction:** When executing pib-db actions with large notes fields (too big for inline pib_query display), /execute built from action titles and general architectural knowledge instead of reading the detailed specs. Phases 2b and 2c of the web app were marked complete without any of the specified components (morphing animation, useStream hook, ComparisonView, PresetTabs, GlossaryDrawer, etc.). User had to flag the gap twice — first time got loading spinners instead of the actual planned feedback.

**Suggestion:** /execute should have a mandatory pre-build step: read the full action notes before starting. If notes are truncated by pib_query, spawn an agent to retrieve them. At completion, compare output against every component and acceptance criterion in the notes before marking done. Consider a prompt hook on pib_complete_action that requires spec verification.

**Session context:** Building prj:88b9992a (Article Rewriter Web App) — all 9 phases in one session.
