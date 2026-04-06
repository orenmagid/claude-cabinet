#!/bin/bash
# UserPromptSubmit hook for skill telemetry
# Detects /skill-name invocations and logs to JSONL
#
# Configuration (environment variables with defaults):
#   TELEMETRY_FILE — where to write JSONL records
#   DEBUG_LOG      — where to write debug output
#   SKILL_DIR      — where to discover skills (scans */SKILL.md)

TELEMETRY_DIR="${TELEMETRY_DIR:-${HOME}/.claude/telemetry}"
TELEMETRY_FILE="${TELEMETRY_FILE:-${TELEMETRY_DIR}/telemetry.jsonl}"
DEBUG_LOG="${DEBUG_LOG:-${TELEMETRY_DIR}/hook-debug.log}"
SKILL_DIR="${SKILL_DIR:-${HOME}/.claude/skills}"

# Ensure telemetry directory exists
mkdir -p "$(dirname "$TELEMETRY_FILE")"
mkdir -p "$(dirname "$DEBUG_LOG")"

# Auto-discover skill names from skills/*/SKILL.md
SKILLS=""
for skill_path in "$SKILL_DIR"/*/SKILL.md; do
    [ -f "$skill_path" ] || continue
    skill=$(basename "$(dirname "$skill_path")")
    [ "$skill" = "_template" ] && continue
    SKILLS="$SKILLS $skill"
done

# Read hook input from stdin, extract prompt and session_id
INPUT=$(cat)
eval "$(echo "$INPUT" | python3 -c "
import sys, json, shlex
try:
    data = json.load(sys.stdin)
    print(f'PROMPT={shlex.quote(data.get(\"prompt\", \"\"))}')
    print(f'SESSION_ID={shlex.quote(data.get(\"session_id\", \"unknown\"))}')
except:
    print('PROMPT=\"\"')
    print('SESSION_ID=\"unknown\"')
" 2>/dev/null)"

# Check if prompt starts with a slash command
if [[ "$PROMPT" =~ ^/([a-z-]+) ]]; then
    COMMAND="${BASH_REMATCH[1]}"

    # Check if it's a known skill
    for skill in $SKILLS; do
        if [[ "$COMMAND" == "$skill" ]]; then
            TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
            python3 -c "
import json
record = {
    'ts': '$TIMESTAMP',
    'event': 'skill-invoke',
    'skill': '$COMMAND',
    'session_id': '$SESSION_ID'
}
print(json.dumps(record))
" >> "$TELEMETRY_FILE"
            echo "--- skill-telemetry $TIMESTAMP skill=$COMMAND ---" >> "$DEBUG_LOG"
            break
        fi
    done
fi

exit 0
