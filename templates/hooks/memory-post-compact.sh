#!/bin/bash
# PostCompact hook — capture session context before it's lost
#
# Fires on: manual (/compact) and auto (context limit) compaction
# Output: read-only (observability only, 10K char cap)
# Design: D1 (absolute venv path), D2 (never block), D3 (graceful degradation)

VENV_PYTHON="$HOME/.claude-cabinet/omega-venv/bin/python3"
ADAPTER="scripts/cabinet-memory-adapter.py"

# D3: graceful degradation — if venv or adapter missing, exit silently
if [ ! -x "$VENV_PYTHON" ] || [ ! -f "$ADAPTER" ]; then
    exit 0
fi

# Read hook input from stdin (includes compact_summary)
INPUT=$(cat)

# Call adapter — pipe hook input as stdin for capture
RESULT=$(echo "$INPUT" | "$VENV_PYTHON" "$ADAPTER" capture 2>/dev/null)

# Log result for observability (PostCompact output is read-only)
STORED=$(echo "$RESULT" | "$VENV_PYTHON" -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('ok'):
        count = data.get('stored', 0)
        if count:
            print(f'cabinet-memory: captured {count} memories from compaction')
        else:
            print('cabinet-memory: no memories captured (nothing noteworthy)')
    else:
        print(f'cabinet-memory: {data.get(\"error\", \"unknown error\")}')
except:
    pass
" 2>/dev/null)

if [ -n "$STORED" ]; then
    echo "$STORED"
fi

exit 0
