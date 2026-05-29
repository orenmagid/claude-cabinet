# Ship a dedicated test stack scaffold by default (test DB + test server + isolated proxy)

Source: flow
Component: verify (test isolation)
Date: 2026-05-17

## Friction

The generated `e2e/` setup targets the project's real dev server, which writes to the project's real local DB. For Flow, that DB is the pulled cache of production data — every test run pollutes it with `verify-smoke parent`, `smoke alpha`, etc., and a stray `--push` to Railway would leak those into prod.

Nothing in `/verify learn`'s output or in `cabinet-verify`'s docs mentions test isolation. The bare minimum a consumer needs to safely run the harness is:

1. A separate DB file (or schema) for tests.
2. A separate API server pointing at that DB (different port).
3. A separate dev server proxying API calls to that test API (different port).
4. An env-overridable API proxy target in the dev server config.

I ended up building all four ad-hoc:
- `e2e/fixtures/flow.test.db` (copy of real DB)
- A `bash e2e/start-test-stack.sh` script that boots Express on :3457 with `DB_PATH` overridden, and Vite on :5176 with `FLOW_API_TARGET` env var.
- A one-line patch to the project's `vite.config.ts` to read `process.env.FLOW_API_TARGET`.

This is non-obvious work and has real safety stakes. It would have prevented Flow Dev finding `act:4bde47f2` (orphan projects) from existing in the user's real local DB.

## Suggestion

Extend install.sh to generate a `start-test-stack.sh` (or `test-server.mjs`) tailored to the project's stack. The skill probably needs to ask the user during calibrate:
- "Does your dev stack write to a real DB? (yes/no)"
- If yes, "Where's the DB file?" → generates the test-DB-copy + override script.
- "Where's the dev server proxy config?" → generates patch instructions.

Alternatively, document the pattern with a recipe in `templates/verify-runtime/` and a calibrate question that surfaces it. Even just a warning during install would help.

## Session context

Flow's `/verify learn` initially wrote to the real local DB. After ~3 deep scenarios, leftover `verify-smoke parent` rows + orphan child projects accumulated in the user's working environment. User asked: "what's happening with data created during these runs?" The right answer was to set up an isolated stack — but only because the user noticed and asked. Without that intervention, the harness would have polluted the local cache indefinitely.
