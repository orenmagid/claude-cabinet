#!/bin/bash
# PreToolUse hook on pib_complete_action
# Blocks completion unless verification breadcrumb exists.
#
# The execute skill writes breadcrumbs to .claude/verification/<fid>.json
# at two points:
#   Step 1 (spec loaded): spec_read = true
#   Step 7 (AC verified): ac_verified = true
#
# This hook checks both phases are recorded.
# Works whether you used /execute or worked ad-hoc.

INPUT="$CLAUDE_TOOL_INPUT"
FID=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('fid',''))" 2>/dev/null)

if [ -z "$FID" ]; then
  echo '{"decision":"allow"}'
  exit 0
fi

VERIFY_DIR=".claude/verification"
BREADCRUMB="$VERIFY_DIR/$FID.json"

if [ ! -f "$BREADCRUMB" ]; then
  NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  cat <<EOF
{"decision":"block","reason":"No verification record for action $FID. Before completing:\n1. Read the full spec: use pib_get_action with fid $FID\n2. Create breadcrumb: mkdir -p $VERIFY_DIR && echo '{\"fid\":\"$FID\",\"spec_read\":true,\"spec_read_at\":\"$NOW\",\"ac_verified\":false}' > $BREADCRUMB\n3. Verify each AC against implementation\n4. Update breadcrumb with ac_verified:true and verification_summary\n5. Retry completion."}
EOF
  exit 0
fi

# Check breadcrumb has both phases
SPEC_READ=$(python3 -c "import json; d=json.load(open('$BREADCRUMB')); print(d.get('spec_read',False))" 2>/dev/null)
AC_VERIFIED=$(python3 -c "import json; d=json.load(open('$BREADCRUMB')); print(d.get('ac_verified',False))" 2>/dev/null)

if [ "$SPEC_READ" != "True" ]; then
  echo "{\"decision\":\"block\",\"reason\":\"Verification record exists but spec not read. Use pib_get_action to read full notes for $FID, then update $BREADCRUMB with spec_read: true.\"}"
  exit 0
fi

if [ "$AC_VERIFIED" != "True" ]; then
  echo "{\"decision\":\"block\",\"reason\":\"Spec was read but ACs not verified. Compare implementation against each acceptance criterion in the spec, then update $BREADCRUMB with ac_verified: true and a verification_summary.\"}"
  exit 0
fi

echo '{"decision":"allow"}'
