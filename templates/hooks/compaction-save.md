# Compaction State Save — PreCompact Prompt Hook

Before compaction destroys your current context, you MUST save state so the
next session can recover. This is not optional — compaction erases everything
you're holding in working memory.

## Required: Always write .claude/compaction-state.md

Write this file with these structured sections:

```
# Compaction State

## Current Task
What you were actively working on. Be specific — include file paths, function
names, the exact step you were on.

## Decisions Made
Key decisions from this session that a fresh context needs to know.
Include the reasoning, not just the conclusion.

## Next Steps
What should happen immediately after recovery. Ordered list, most urgent first.

## References
Files, URLs, error messages, or other artifacts that the next context will need.
```

## Conditional: Write workflow-specific partial state

If you are in the middle of a multi-step workflow with intermediate results,
ALSO write a partial state file to `.claude/<workflow-name>-partial.md`.

Use the workflow you're currently executing as the filename. Examples:
- Mid-audit with findings collected so far → `.claude/audit-partial.md`
- Mid-migration with some files moved → `.claude/migration-partial.md`
- Mid-refactor tracking what's done → `.claude/refactor-partial.md`

Include whatever intermediate work products would be lost to compaction:
completed items, partial results, progress tracking, error logs.

## Constraints

- Keep total output under 200 lines across all files written.
- Use concrete details (file paths, line numbers, variable names), not vague summaries.
- Write the files using the Edit/Write tools — do not just describe what you would write.
