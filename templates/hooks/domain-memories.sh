#!/bin/bash
# PreToolUse prompt hook on Edit|Write
# Surfaces prevent-type memories BEFORE editing files in risky domains.
#
# Two-tier domain identification:
# 1. Static map: known high-risk file patterns → behavioral search terms
# 2. Dynamic fallback: omega query with file path context
#
# Projects extend the static map via phases/domain-memories.md

INPUT="$CLAUDE_TOOL_INPUT"
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('file_path', d.get('path','')))" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

OMEGA_BIN="$HOME/.claude-cabinet/omega-venv/bin/omega"
if [ ! -x "$OMEGA_BIN" ]; then
  exit 0
fi

# Tier 1: Static domain map — known high-risk patterns
SEARCH_TERM=""
case "$FILE_PATH" in
  *playwright*|*puppeteer*|*selenium*|*cypress*|*webdriver*)
    SEARCH_TERM="browser automation testing prevent mistakes constraints" ;;
  *deploy*|*railway*|*docker*|*fly.toml*|*vercel*|*Dockerfile*)
    SEARCH_TERM="deployment prevent mistakes constraints gotchas" ;;
  *migration*|*schema*|*.sql*|*prisma*|*drizzle*)
    SEARCH_TERM="database migration prevent mistakes constraints" ;;
  *auth*|*session*|*token*|*credential*|*login*|*oauth*)
    SEARCH_TERM="authentication security prevent mistakes constraints" ;;
  *webhook*|*stripe*|*payment*|*billing*)
    SEARCH_TERM="payment webhook prevent mistakes constraints" ;;
esac

# Check for project-specific domain extensions
PHASE_FILE=".claude/skills/hooks/phases/domain-memories.md"
if [ -f "$PHASE_FILE" ] && [ -z "$SEARCH_TERM" ]; then
  # Phase file can define additional pattern|search terms (one per line)
  while IFS='|' read -r pattern terms; do
    [ -z "$pattern" ] && continue
    if echo "$FILE_PATH" | grep -qE "$pattern"; then
      SEARCH_TERM="$terms"
      break
    fi
  done < "$PHASE_FILE"
fi

# Tier 2: Dynamic fallback — query omega with file context
if [ -z "$SEARCH_TERM" ]; then
  BASENAME=$(basename "$FILE_PATH")
  DIRNAME=$(basename "$(dirname "$FILE_PATH")")
  SEARCH_TERM="prevent mistakes constraints when editing $DIRNAME $BASENAME"
fi

# Query omega for prevent-type memories
MEMORIES=$("$OMEGA_BIN" query "$SEARCH_TERM" --type constraint --type error_pattern --limit 3 2>/dev/null)

if [ -n "$MEMORIES" ] && [ "$MEMORIES" != "No results" ] && [ "$MEMORIES" != "[]" ]; then
  echo "⚠ RELEVANT MEMORIES for $(basename "$FILE_PATH"):"
  echo "$MEMORIES"
  echo "---"
fi
