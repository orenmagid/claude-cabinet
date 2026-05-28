---
type: field-feedback
source: theater-cheater
date: 2026-04-20
component: skills/orient (omega integration)
---

## omega_protocol() errors every session — "No module named 'omega.protocol'"

**Friction:** The `orient` skill (and the global CLAUDE.md memory guidance)
instructs Claude to call `omega_protocol()` at session start. The call
fails with `Protocol failed: No module named 'omega.protocol'`.
`omega_welcome()` works fine in the same session, so the omega MCP
server is connected — just the protocol submodule is missing. Every
orient hits this; it becomes noise.

**Suggestion:** Either (a) CC's orient skill should degrade gracefully
when `omega_protocol()` fails (catch + continue, don't surface as a
health warning), or (b) CC's installer / omega bootstrap should verify
the `omega.protocol` module is importable and surface a fix if not.
Unclear whether the missing submodule is an omega-venv packaging issue
or a CC-installer issue — filing so the CC side can route it.

**Session context:** /orient in theater-cheater (Puppeteer booking bot,
Phase 2 deployed to Railway). CC v0.24.0 installed via create-claude-cabinet.
