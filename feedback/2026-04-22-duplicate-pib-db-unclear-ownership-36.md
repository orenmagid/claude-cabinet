# Duplicate pib.db at repo root and scripts/ — unclear ownership

**Source:** article-rewriter (de[sic]ify) project, 2026-04-22 pre-beta audit.

## Observation

The cabinet-architecture member flagged (`architecture-0006`):

> The repo root holds `pib.db`, `pib.db-shm`, `pib.db-wal` — the work-tracker DB driven by `scripts/pib-db-mcp-server.mjs`, mounted as a project-scope MCP server in `.mcp.json`. `scripts/` also holds its own `pib.db`.

User response:

> "How did this happen, though? Did Claude Cabinet do it? Let's make sure we don't delete the wrong one and file /cc-feedback, please."

## What we don't know

- Which pib.db is canonical? The `.mcp.json` points at `./pib.db` (repo root), so that's the one MCP reads/writes. The `scripts/pib.db` appears to be a stale duplicate — but we don't know how it was created.
- Did the CC installer create it? Did a script migration accidentally produce it? Did it pre-date a path change?

If CC's installer or any CC-provided script is putting pib.db in `scripts/`, that's the bug. If it's not CC's fault, the project can just delete it — but the user explicitly wanted to surface this upstream before taking action.

## Possible shapes for a fix (if CC-caused)

1. Audit whether any CC installer step or migration script creates `scripts/pib.db`. If yes, fix the script to use the repo-root path consistently.

2. Add a convention enforcement: CC should document that `pib.db` lives at the repo root (matching `.mcp.json` convention), and any CC-provided scripts that touch it should use `process.env.PIB_DB_PATH || path.join(repoRoot, 'pib.db')` — never a path relative to the script's own directory.

3. If this is NOT CC's fault, the feedback itself is still useful: confirming the source rules out CC as a suspect.

## Action for this project (independent of CC resolution)

The `[AUDIT] Architecture + Data Integrity` project (prj:08af9878) tracks this as part of the architecture cleanup plan (act:798860a3). Once CC confirms / denies authorship, the project will delete the stale copy safely.
