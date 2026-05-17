# cabinet-verify 0.2.0 — what shipped and why it matters

Walkthrough verification — Cucumber scenarios with a human in the
loop for the parts a robot can't judge — is the format Claude Cabinet
uses to keep multi-PR umbrellas verified instead of forgotten. The
runtime, `cabinet-verify`, lives as a small npm package consumers
install into their `e2e/` directory.

Flow's first cold-start through `/verify learn` surfaced three
classes of friction stacked on top of each other: a fresh install on
Node 22 couldn't run a single step (`NODE_OPTIONS='--env-file=...'`
is rejected on Node 22+, and the generated scripts hadn't migrated to
the CLI form), every project re-implemented the same five Cucumber
step handlers because the runtime didn't own them, and scenarios run
straight against the project's dev stack — which for many projects
means a real database whose pollution can leak to production.

This session shipped four coordinated changes (cabinet-verify 0.2.0,
plus three skill-side phase updates) that resolve the entire stack.
Generated `e2e/package.json` now uses Node's CLI `--env-file-if-exists`
across the board and pins `engines.node >= 20.12`. The runtime owns
five universal step handlers via a side-effect import and exposes a
two-function public API (`setSignInHandler`, `registerCheck`) so
consumers register their project-specific bits instead of redeclaring
the boilerplate. A new opt-in calibrate path detects when the dev
stack writes to a real DB and emits an isolation scaffold —
`e2e/start-test-stack.sh` plus a documenting README — that snapshots
the DB into `e2e/fixtures/` and runs the harness against a separate
port pair (default API 3457, dev 5176). Projects without that risk
get nothing extra; default behavior is preserved.

The non-obvious load-bearing mechanism is the **registry pattern in
baseline-steps.ts**. cucumber-js throws on duplicate step definitions,
so a generic handler can live in exactly one place; the registry
turns that constraint from a footgun (asymmetric "do NOT redeclare"
comments) into the natural API (call `registerCheck` per assertion).
The verification a stakeholder would run is also concrete: on a fresh
Node 22 project, `npm install && npm run install:browsers && npm run
verify` against a stub scenario produces 1/1 passing step, no
`Undefined` errors, no `signInAs: not implemented` regardless of
whether real credentials are present in `.env.local`. The earlier
30-minute chase becomes a one-shot bootstrap.
