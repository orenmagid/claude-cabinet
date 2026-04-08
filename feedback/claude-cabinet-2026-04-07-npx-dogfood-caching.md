---
type: field-feedback
source: claude-cabinet
date: 2026-04-07
component: install / dogfood workflow
---

## npx resolves local package when dogfooding

**Friction:** When running `npx create-claude-cabinet@0.11.2` from inside
the claude-cabinet source directory, npx resolves the local `package.json`
(which may have an older version in its npm cache) instead of fetching
from the registry. Even `npm cache clean --force` doesn't fix it. This
installed v0.8.5 templates over a v0.11.1 dogfood install, requiring
manual recovery with `node bin/create-claude-cabinet.js --yes`.

**Suggestion:** Document the dogfood install command in CLAUDE.md or a
dev guide: always use `node bin/create-claude-cabinet.js --yes` when
installing on the source repo itself. Could also add a check in the CLI
that warns if it detects it's running inside its own source directory.

**Session context:** Publishing v0.11.2 and dogfooding it on the CC
source repo.
