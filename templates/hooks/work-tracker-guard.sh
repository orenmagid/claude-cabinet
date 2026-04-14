#!/bin/bash
# PreToolUse hook on Bash tool
# Blocks raw SQL operations against work tracker tables.
# Consuming projects customize via phases/work-tracker-guard.md
#
# Default: guards pib-db actions table
# Disable: phase file with "skip: true"

INPUT="$CLAUDE_TOOL_INPUT"
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('command',''))" 2>/dev/null)

if [ -z "$COMMAND" ]; then
  echo '{"decision":"allow"}'
  exit 0
fi

# Check for phase file override
PHASE_FILE=".claude/skills/hooks/phases/work-tracker-guard.md"
if [ -f "$PHASE_FILE" ]; then
  FIRST_LINE=$(head -1 "$PHASE_FILE")
  if [ "$FIRST_LINE" = "skip: true" ]; then
    echo '{"decision":"allow"}'
    exit 0
  fi
fi

# Check for SQL operations against actions table
if echo "$COMMAND" | grep -qiE '(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+actions'; then
  # Override escape hatch
  if echo "$COMMAND" | grep -q '\-\-force-raw-sql'; then
    echo '{"decision":"allow","reason":"Raw SQL override acknowledged. Quality gates bypassed."}'
    exit 0
  fi
  echo '{"decision":"block","reason":"Raw SQL against actions table detected. Use MCP tools instead: pib_create_action, pib_update_action, pib_complete_action, pib_get_action. These enforce quality gates. To override (almost certainly wrong): add --force-raw-sql to your command."}'
  exit 0
fi

echo '{"decision":"allow"}'
