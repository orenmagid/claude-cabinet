#!/bin/bash
# PreToolUse hook on pib_create_action
# Blocks action creation when notes fail quality checks.
#
# Quality criteria (from field feedback analysis):
# 1. Notes field is present and non-empty
# 2. Notes are not just a copy of the title (text field)
# 3. Notes are at least 100 characters (a meaningful paragraph)
# 4. Notes contain an acceptance criteria section
# 5. Notes contain a surface area section
#
# These fire on ALL pib_create_action calls — whether from /plan,
# /execute, or ad-hoc. The hook doesn't care how you got here.

INPUT="$CLAUDE_TOOL_INPUT"

NOTES=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('notes',''))" 2>/dev/null)
TEXT=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('text',''))" 2>/dev/null)

if [ -z "$NOTES" ]; then
  echo '{"decision":"block","reason":"Action notes are empty. Every action needs notes with: implementation details, acceptance criteria (## AC or ## Acceptance Criteria), and surface area (## Surface Area with - files: entries). The bar: a cold-start developer reads ONLY these notes and can implement correctly."}'
  exit 0
fi

# Check: notes are not just the title repeated
if [ "$NOTES" = "$TEXT" ]; then
  echo '{"decision":"block","reason":"Action notes are identical to the title. Notes must contain implementation details, acceptance criteria, and surface area — not just a restated title."}'
  exit 0
fi

# Check: minimum length (100 chars)
NOTE_LEN=${#NOTES}
if [ "$NOTE_LEN" -lt 100 ]; then
  echo "{\"decision\":\"block\",\"reason\":\"Action notes are only ${NOTE_LEN} characters. Minimum is 100. Include: implementation approach, acceptance criteria (## Acceptance Criteria), and surface area (## Surface Area).\"}"
  exit 0
fi

# Check: has acceptance criteria section
if ! echo "$NOTES" | grep -qiE '(## (AC|Acceptance|Criteria)|(\*\*AC|\*\*Acceptance)|- \[[ x]\])'; then
  echo '{"decision":"block","reason":"Action notes have no acceptance criteria section. Add ## Acceptance Criteria containing testable pass/fail criteria."}'
  exit 0
fi

# Check: has surface area section
if ! echo "$NOTES" | grep -qiE '(## Surface|files:|dirs:)'; then
  echo '{"decision":"block","reason":"Action notes have no surface area section. Add ## Surface Area with - files: path/to/file entries listing files this action changes."}'
  exit 0
fi

echo '{"decision":"allow"}'
