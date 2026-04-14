---
type: field-feedback
source: claude-cabinet
date: 2026-04-14
component: skills/cc-publish
---

## cc-publish consumer commit bundles pre-staged project files

**Skill/phase:** cc-publish Step 6 (Update Local Consumers)
**Friction:** When committing CC-managed files in consumer repos, the publish skill does `git add <cc-files> && git commit`. If the consumer has previously-staged project files in the index (from a prior session), they get silently bundled into the CC update commit. v0.19.2 consumer updates accidentally committed App.tsx, package.json, and other project-owned files. Required soft-reset and recommit to fix.
**Suggestion:** Add `git reset HEAD -- .` before `git add`-ing CC files in the consumer update step. The sequence should be: reset staging → add only CC files → commit.
**Session context:** Publishing v0.19.2 template fix and updating 3 consumers.
