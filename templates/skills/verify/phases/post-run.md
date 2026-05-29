# Post-Run Actions

Define consumer-specific actions that should happen after every
`/verify run` completes, regardless of pass or fail. Runs after
the result summary is surfaced but before the cleanup offer.

**Default (absent/empty):** Skip. Results are already persisted in
`e2e/reports/` and `e2e/screenshots/`.

## When to use

Use this phase for side effects that should follow every run:
- Uploading screenshots or Playwright traces to shared storage
- Posting a summary to a Slack channel or notification service
- Archiving trace files to a dated directory
- Updating an external dashboard or status page
