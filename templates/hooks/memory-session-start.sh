#!/bin/bash
# SessionStart hook — surface relevant memories via omega
#
# Fires on: startup, resume, compact (not clear — fresh context)
# Output: relevant memories injected into session context
# Design: D1 (absolute venv path), D2 (never block), D3 (graceful degradation)

VENV_PYTHON="$HOME/.claude-cabinet/omega-venv/bin/python3"
ADAPTER="scripts/cabinet-memory-adapter.py"

# D3: graceful degradation — if venv or adapter missing, warn but don't block
if [ ! -x "$VENV_PYTHON" ] || [ ! -f "$ADAPTER" ]; then
    echo ""
    echo "**Note:** Memory module is installed but omega is not available."
    echo "Semantic memory (decisions, lessons, preferences) is not being captured or recalled."
    echo "Run \`npx create-claude-cabinet\` to set up the omega venv."
    exit 0
fi

# Read hook input from stdin
INPUT=$(cat)

# Extract source field to skip /clear (fresh context, no memories needed)
SOURCE=$(echo "$INPUT" | "$VENV_PYTHON" -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('source', 'startup'))
except:
    print('startup')
" 2>/dev/null)

if [ "$SOURCE" = "clear" ]; then
    exit 0
fi

# Call adapter — pipe hook input as stdin
RESULT=$(echo "$INPUT" | "$VENV_PYTHON" "$ADAPTER" welcome 2>/dev/null)

# Extract context from result
CONTEXT=$(echo "$RESULT" | "$VENV_PYTHON" -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('ok') and data.get('context'):
        print(data['context'])
except:
    pass
" 2>/dev/null)

# Output context to stdout — SessionStart hook stdout becomes session context
if [ -n "$CONTEXT" ]; then
    echo ""
    echo "## Recalled Memories (omega)"
    echo ""
    echo "$CONTEXT"
fi

exit 0
