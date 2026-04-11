#!/bin/bash
# Compaction Recovery — SessionStart command hook (compact matcher)
#
# Reads compaction state files written by the PreCompact prompt hook
# and outputs them to stdout for injection as additionalContext.
#
# Files checked:
#   .claude/compaction-state.md  — always (main state)
#   .claude/*-partial.md         — any workflow partial state files

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
STATE_FILE="$PROJECT_DIR/.claude/compaction-state.md"

# Collect all partial state files
PARTIAL_FILES=()
for f in "$PROJECT_DIR"/.claude/*-partial.md; do
  [ -f "$f" ] && PARTIAL_FILES+=("$f")
done

# If no state files exist, output fallback message
if [ ! -f "$STATE_FILE" ] && [ ${#PARTIAL_FILES[@]} -eq 0 ]; then
  echo "No compaction state found. This session started fresh (no prior compaction state to recover)."
  exit 0
fi

echo "=== COMPACTION RECOVERY ==="
echo ""
echo "State was saved before compaction. Use this to resume where you left off."
echo ""

# Output main state file
if [ -f "$STATE_FILE" ]; then
  echo "--- compaction-state.md ---"
  cat "$STATE_FILE"
  echo ""
fi

# Output any partial state files
for f in "${PARTIAL_FILES[@]}"; do
  BASENAME=$(basename "$f")
  echo "--- $BASENAME ---"
  cat "$f"
  echo ""
done

echo "=== END COMPACTION RECOVERY ==="
