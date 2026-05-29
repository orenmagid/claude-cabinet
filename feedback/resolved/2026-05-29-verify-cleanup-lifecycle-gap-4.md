---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-29
component: verify (skill lifecycle + cleanup)
---

## Verify skill doesn't own execution — so its lifecycle is useless

**Friction (architectural):** The verify skill has two modes:
`/verify learn` (generates Cucumber/Playwright scenarios into `e2e/`)
and... nothing. Actually running the scenarios is a raw `npm test`
(or `npx cucumber-js`) in the `e2e/` directory, completely outside
Claude Code's skill system. This makes the entire skill lifecycle
(phases, consumer configuration, hooks) irrelevant at execution time:

1. **No skill context during execution.** The test runner is a
   standalone npm process. No Claude skill is active, so no phases
   fire, no timestamps are recorded, no post-run hooks exist.

2. **Consumer customization is impossible.** Phase files only work
   inside a skill invocation. Since execution isn't a skill, consumers
   can't configure pre-run setup, post-run cleanup, reporting, or
   anything else through the phase system.

3. **No recorded timestamp.** The skill doesn't know when a run
   happened because it wasn't there for the run. The consuming
   project had to hand-write a `verify:cleanup` rake task that
   requires `SINCE=<timestamp>` — but nobody records that timestamp.

4. **Cleanup is orphaned.** The consuming project independently
   discovered it needs a cleanup mechanism, wrote a rake task, but
   has no way to invoke it as part of a verify lifecycle because
   there IS no verify lifecycle at execution time.

5. **Remote execution gap.** For deployed apps (the common case —
   verify tests a live URL), cleanup commands run via `railway run`
   or equivalent. The skill can't configure or invoke this because
   it's not present during or after execution.

**Root cause:** The skill treats "generate" as its job and
"execute" as someone else's job. But generation without execution
ownership means the skill can never close the loop: it creates
test infrastructure that produces side effects it can't manage.

**Suggestion:** The verify skill needs a `/verify run` command (or
equivalent) that wraps the npm execution inside a skill invocation:

```
/verify run          # runs scenarios, records timestamp, offers cleanup
/verify run --demo   # HEADLESS=false with narration
/verify cleanup      # uses recorded timestamp + consumer-configured command
```

Implementation: `/verify run` would:
1. Record start timestamp to `e2e/.last-verify-run`
2. Execute the npm command (`npx cucumber-js` or configured equivalent)
3. Capture results (pass/fail, screenshots, timings)
4. Offer cleanup via consumer-configured command (phase file):
   ```
   # e2e/phases/cleanup.md (or verify/phases/cleanup.md)
   command: "railway run --service web bin/rails verify:cleanup SINCE='{timestamp}'"
   ```
5. Report results in a skill-formatted output

This way the full lifecycle lives inside a skill context where
consumers can customize every phase. The standalone `npm test`
still works for CI or manual runs — `/verify run` is the
skill-aware wrapper for interactive use from Claude Code.

**Secondary issue — cleanup task generation:** `/verify learn`
generates scenarios and step definitions. It should ALSO generate
a cleanup task scaffold based on the models it discovered during
scenario generation. The consuming project shouldn't have to
independently figure out "oh, I need to clean up Claimants,
Claims, ClaimantEvents, and NQLs after test runs."

**Session context:** First real verify run on Maginnis Howard
(Railway staging). Test data created during scenarios persisted
in the database. Had to manually construct a timestamp, couldn't
run the cleanup rake task from Claude Code (no local Ruby), and
the orphaned test data contributed to login confusion. The entire
problem would have been avoided if the skill owned execution.
