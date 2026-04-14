---
type: field-feedback
source: theater-cheater
date: 2026-04-13
component: auto-memory / omega integration
---

## Auto-memory system prompt conflicts with omega — Claude defaults to file-based memory

**Friction:** The system prompt's auto-memory instructions describe a file-based memory system (write .md files to a memory directory, maintain MEMORY.md index). The project uses omega for memory. CLAUDE.md says to use omega. When Claude needed to store a lesson, it defaulted to the file-based system from the system prompt, created a .md file and updated MEMORY.md. User had to correct this. Then Claude fumbled the omega CLI syntax (used `--text` flag that doesn't exist, had to check `--help`).

**Suggestion:** When omega is configured and active, the auto-memory instructions should either be suppressed or explicitly say "this project uses omega — use omega_store() or the omega CLI instead of file-based memory." The memory-capture.md rules file partially addresses this but the system prompt's instructions are louder.

**Session context:** Trying to store a lesson about Railway CLI deployment after discovering no git remote was configured.
