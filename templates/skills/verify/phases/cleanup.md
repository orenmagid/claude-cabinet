# Test Data Cleanup

Define the command that cleans up test data created during a verify run.
Used by `/verify cleanup` and offered automatically at the end of
`/verify run` when scenarios created test data.

**Default (absent/empty):** `/verify cleanup` tells the user to create
this file. No automatic cleanup is offered after runs.

## Format

Provide a `command:` line with the shell command to execute. Use
`{timestamp}` where the ISO-8601 start time of the last run should be
substituted.

```
command: "railway run --service web bin/rails verify:cleanup SINCE='{timestamp}'"
```

## Other examples

```
# Direct SQL cleanup
command: "psql $DATABASE_URL -c \"DELETE FROM test_records WHERE created_at >= '{timestamp}'\""

# API-based cleanup
command: "curl -X POST http://localhost:3457/api/test/cleanup -d '{\"since\": \"{timestamp}\"}'"

# Local script
command: "node scripts/cleanup-test-data.mjs --since '{timestamp}'"
```

## What models to clean

During `/verify learn`, the discover phase identifies which models and
entities scenarios create. If you're not sure what to clean, check the
step definitions in `e2e/steps/` for create/fill/submit actions and
trace which database tables they touch.
