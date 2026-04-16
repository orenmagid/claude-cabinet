#!/bin/bash
# Omega Memory Guard — PreToolUse hook for Edit and Write tool calls
#
# When omega is available, blocks writes to flat markdown memory files.
# Semantic memories belong in omega (searchable, deduplicated, graph-linked).
# Flat markdown is the fallback ONLY when omega is unavailable.
#
# Scope:
#   BLOCKS:  .claude/memory/*.md, .claude/projects/*/memory/*.md
#   ALLOWS:  MEMORY.md index files (structural, not memory content)
#   ALLOWS:  memory/patterns/*.md (enforcement pipeline artifacts)
#   ALLOWS:  Everything if omega is unavailable (flat markdown IS correct fallback)
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

# Only care about memory directory paths
# Note: case patterns with * don't cross / boundaries in some shells,
# so we use [[ ]] substring matching for absolute path compatibility.
if [[ "$FILE_PATH" != *"/.claude/memory/"* ]] && [[ "$FILE_PATH" != *"/.claude/projects/"*"/memory/"* ]]; then
  echo '{"decision":"allow"}'
  exit 0
fi

# Allow MEMORY.md index files (structural, not memory content)
BASENAME=$(basename "$FILE_PATH")
if [ "$BASENAME" = "MEMORY.md" ]; then
  echo '{"decision":"allow"}'
  exit 0
fi

# Allow pattern files (enforcement pipeline artifacts, not semantic memories)
case "$FILE_PATH" in
  */memory/patterns/*)
    echo '{"decision":"allow"}'
    exit 0
    ;;
esac

# Check if omega is available
OMEGA_PYTHON="$HOME/.claude-cabinet/omega-venv/bin/python3"
if [ ! -x "$OMEGA_PYTHON" ]; then
  # Omega not available — flat markdown IS the correct fallback
  echo '{"decision":"allow"}'
  exit 0
fi

# Find the adapter script
find_adapter() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/scripts/cabinet-memory-adapter.py" ]; then
      echo "$dir/scripts/cabinet-memory-adapter.py"
      return 0
    fi
    dir=$(dirname "$dir")
  done
  return 1
}

ADAPTER=$(find_adapter)
if [ -z "$ADAPTER" ]; then
  # No adapter found — flat markdown fallback is correct
  echo '{"decision":"allow"}'
  exit 0
fi

# Omega is available — block the flat markdown write
echo "{\"decision\":\"block\",\"reason\":\"Omega is active — use omega_store() or the adapter instead of writing to flat markdown memory files. Run: echo '{\\\"text\\\": \\\"your memory\\\", \\\"type\\\": \\\"lesson\\\"}' | $OMEGA_PYTHON $ADAPTER store\"}"
