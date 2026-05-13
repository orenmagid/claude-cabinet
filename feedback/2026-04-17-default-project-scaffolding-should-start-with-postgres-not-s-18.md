# Default project scaffolding should start with Postgres, not SQLite

**Source:** project-scaffolding guidance / default DB choice in CC templates.

**Friction observed:** In de[sic]ify (a small side project — one user, maybe 10 friends soon) we started with SQLite because it was "simpler for a small project." A few days into real use, hit the concurrency wall:
- A single long-running rewrite (Opus + extended thinking + 10+ minute generation) locked every other request, including `/api/health`. Root cause turned out to be *two* compounding issues:
  1. SQLite writer-lock serializing readers against in-progress writes during result persistence.
  2. Sync generator consumed inside an `async def` pinning the event loop during streaming.
- The SQLite part is fixable with WAL mode (one-liner pragma) but the fact that we hit this at all on a single-user app surprised us.
- Now evaluating Postgres migration as follow-up work. Realistic 2-3 day port for 5 raw-sqlite3 stores — not huge, but entirely avoidable if we'd defaulted to Postgres from day one.

**Pattern:** "It's a small project, SQLite is fine" is a reasoning trap. The project stays "small" for exactly as long as nobody uses it. The moment it gets real users (even a handful), you discover the concurrency model matters. And the migration cost you save on day 1 is paid back with interest on day 30 when you have production users, live data to migrate, and deploy anxiety.

**Suggestion for CC templates/scaffolding:** If CC provides project scaffolding (web app starter, FastAPI template, etc.), default to Postgres with a local docker-compose or Railway-addon config. Mention SQLite as an explicit opt-in for read-heavy single-writer scenarios (docs generators, personal tools), not as the default.

**If there's no scaffolding layer:** add a guidance note to the "starting a new project" pattern in CC docs — something like:
> **Pick your persistence tier upfront.** The migration cost grows with each row inserted. Default to Postgres unless you have a clear reason (static blog, offline CLI tool) to prefer SQLite. "It's a small project" is not that reason.

**Also worth surfacing:** the compound pitfall. SQLite's concurrency issues are well-known, but the async-def-iterating-sync-generator issue can look like a DB bug until you trace it. If CC has web-app scaffolding, the FastAPI route pattern for SSE should either:
- Use async generators end-to-end, or
- Wrap sync generators via `anyio.to_thread.run_sync` with an `asyncio.Queue` bridge.

Both patterns are non-obvious to discover under pressure.
