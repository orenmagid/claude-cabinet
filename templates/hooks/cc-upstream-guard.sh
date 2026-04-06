#!/bin/bash
# CC Upstream Guard — PreToolUse hook for Edit and Write tool calls
#
# Blocks modifications to files managed by Claude Cabinet. These files
# are upstream-owned: updates come through /cc-upgrade, not direct edits.
# Project-specific customization goes in briefing files and phase files.
#
# How it works:
#   Reads .ccrc.json manifest (list of CC-installed files with hashes).
#   If the target file_path is in the manifest, block the write.
#
# ROLLBACK: Comment out the PreToolUse entry for this hook in
# .claude/settings.json to disable it immediately.
#
# Hook contract:
#   Input: $CLAUDE_TOOL_INPUT has the tool use JSON with "file_path" field
#   Output: JSON on stdout with { "decision": "block"|"allow", "reason": "..." }

# Extract file_path from tool input
FILE_PATH=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('file_path',''))" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  echo '{"decision":"allow"}'
  exit 0
fi

# Find the project root (where .ccrc.json lives)
# Walk up from current directory
find_project_root() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/.ccrc.json" ]; then
      echo "$dir"
      return 0
    fi
    dir=$(dirname "$dir")
  done
  return 1
}

PROJECT_ROOT=$(find_project_root)

if [ -z "$PROJECT_ROOT" ]; then
  # No .ccrc.json found — not a CC project, allow everything
  echo '{"decision":"allow"}'
  exit 0
fi

# Resolve file_path to a relative path from project root
# Handle both absolute and relative paths
if [[ "$FILE_PATH" = /* ]]; then
  # Absolute path — make relative to project root
  REL_PATH="${FILE_PATH#$PROJECT_ROOT/}"
  # If the path didn't change, the file is outside the project
  if [ "$REL_PATH" = "$FILE_PATH" ]; then
    echo '{"decision":"allow"}'
    exit 0
  fi
else
  REL_PATH="$FILE_PATH"
fi

# Check if this relative path is in the manifest
IN_MANIFEST=$(python3 -c "
import json, sys
try:
    with open('$PROJECT_ROOT/.ccrc.json') as f:
        data = json.load(f)
    manifest = data.get('manifest', {})
    print('yes' if '$REL_PATH' in manifest else 'no')
except:
    print('no')
" 2>/dev/null)

if [ "$IN_MANIFEST" = "yes" ]; then
  echo "{\"decision\":\"block\",\"reason\":\"Blocked: $REL_PATH is managed by Claude Cabinet. CC-managed files are upstream-owned — edits come through /cc-upgrade, not direct modification. Put project-specific content in briefing files or phase files instead.\"}"
else
  echo '{"decision":"allow"}'
fi
