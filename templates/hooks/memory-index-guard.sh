#!/usr/bin/env bash
# memory-index-guard — PostToolUse hook on Write/Edit that ensures
# memory-directory writes get indexed in MEMORY.md.
#
# Triggers: PostToolUse on Write/Edit when the target path is under
# ~/.claude/projects/*/memory/*.md (Claude Code's auto-memory dir).
#
# Behavior: runs scripts/validate-memory.mjs against the memory dir.
# If the validator reports orphan files (memory file written but not
# indexed), emits a system reminder pointing Claude at /cc-remember.
#
# This is the post-omega-winddown replacement for omega-memory-guard.sh.
# Where the omega guard BLOCKED markdown writes (redirecting them to
# omega_store), this guard ALLOWS the write but enforces indexing.
#
# Exit codes are advisory — never block the user's tool. Always exit 0.
# The output (if any) goes back to Claude as additional context.

set -u

# Read JSON tool-input from stdin (Claude Code passes hook payload).
PAYLOAD=$(cat)

# Extract tool_input.file_path. Falls back to empty.
FILE_PATH=$(echo "$PAYLOAD" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)

# Bail if no file_path or path doesn't match memory dir pattern.
if [ -z "$FILE_PATH" ]; then
  exit 0
fi
case "$FILE_PATH" in
  */.claude/projects/*/memory/*.md) ;;
  *) exit 0 ;;
esac

# Find the memory dir (strip the filename component).
MEMORY_DIR=$(dirname "$FILE_PATH")
PROJECT_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
VALIDATOR="$PROJECT_ROOT/scripts/validate-memory.mjs"

# If the validator isn't installed in this project, no-op silently.
# (Hook might be installed in a project that hasn't received the
# Phase 3a scripts yet — graceful degradation.)
if [ ! -f "$VALIDATOR" ]; then
  exit 0
fi

# Run validator quietly. If it reports orphans, emit guidance.
OUTPUT=$(node "$VALIDATOR" --memory-dir "$MEMORY_DIR" --quiet 2>&1)
STATUS=$?

if [ $STATUS -eq 0 ]; then
  exit 0
fi

# Print the failure to stdout so it surfaces back to Claude as
# additional context. Frame as a suggestion, not a block.
cat <<REMINDER
[memory-index-guard] $(basename "$FILE_PATH") was written to a memory directory,
but validate-memory.mjs reports an issue:

$OUTPUT

To fix the most common case (orphan memory file not indexed in
MEMORY.md), use /cc-remember next time — it updates MEMORY.md
automatically. Or manually add this file to MEMORY.md's
"## Curated entries (hand-authored)" section.
REMINDER

exit 0
