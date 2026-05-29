# Pre-Run Setup

Define consumer-specific setup that must happen before every `/verify run`
invocation. This runs after the e2e/ check and test-isolation nudge but
before recording the start timestamp.

**Default (absent/empty):** Skip. Most projects don't need pre-run setup
beyond what the preflight script already checks.

## When to use

Use this phase when scenarios depend on external state that must be
prepared before each run:
- Starting an isolated test stack (`bash e2e/start-test-stack.sh --bg`)
- Waiting for a dev server health endpoint
- Seeding test data via an API call
- Resetting a test database to a known state

## When NOT to use

Don't duplicate what preflight already checks. Preflight
(`support/preflight.ts`) verifies preconditions and aborts on failure.
This phase actively sets up state. If the distinction is blurry, prefer
preflight for checks and this phase for mutations.
