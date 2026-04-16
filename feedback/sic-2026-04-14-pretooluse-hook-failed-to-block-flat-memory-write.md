# PreToolUse hook failed to block flat memory write

**Source:** sic  
**Date:** 2026-04-14  
**Component:** hooks/omega-memory-guard

The omega-memory-guard hook is configured as a PreToolUse hook on Edit|Write and should block writes to .claude/projects/*/memory/*.md when omega is available. During debrief, a Write call to /Users/orenmagid/.claude/projects/-Users-orenmagid-article-rewriter/memory/feedback_plan_vs_implement.md succeeded without the hook firing. The file was created, had to be manually deleted, and the memory was re-stored via omega adapter. The hook script's glob pattern (*.claude/projects/*/memory/*) may not match absolute paths correctly — shell case glob * doesn't cross / boundaries, so *.claude/projects/*/memory/* won't match a path like /Users/orenmagid/.claude/projects/-Users-orenmagid-article-rewriter/memory/file.md because the * before .claude needs to cross multiple / separators.

Suggestion: The case pattern should use the absolute path with explicit prefix matching, e.g. */.claude/memory/*|*/.claude/projects/*/memory/*, or switch to a substring check ([[ "$FILE_PATH" == *"/memory/"* ]]) since the MEMORY.md and patterns exceptions are already handled above.

Session context: Debrief phase of UX planning session for [sic] web app.
