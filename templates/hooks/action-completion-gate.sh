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

# --- Group-plan gate (Piece 4) ---
# Plans run via /execute-group carry a grp:<label> tag. For these, the
# workflow's Completion Report is the proof that the checkpoint sequence ran.
# The report is the workflow's own execution record — it either ran the
# checkpoints or it didn't. (Honest ceiling: this proves the workflow ran all
# checkpoints and they returned continue, NOT that the right members reviewed
# or that the review was deep. Auto-upgrades when cabinet subagent identity
# becomes trustworthy.)
#
# Tag lookup is best-effort: if pib.db can't be read, GRP_LABEL is empty and
# this gate is skipped — the base breadcrumb gate above still applies.
DB_PATH="${PIB_DB_PATH:-pib.db}"
TAGS=$(python3 -c "
import sqlite3, sys
try:
    c = sqlite3.connect('$DB_PATH')
    r = c.execute('SELECT tags FROM actions WHERE fid=?', ('$FID',)).fetchone()
    sys.stdout.write(r[0] if r and r[0] else '')
except Exception:
    sys.stdout.write('')
" 2>/dev/null)

GRP_LABEL=$(printf '%s' "$TAGS" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep '^grp:' | head -1 | sed 's/^grp://')
# Sanitize: group labels are date-style tokens (A-Za-z0-9_-). Strip anything
# else before interpolating into a file path / python string — defends against
# path traversal (../) and quote-breaking from a malformed tag.
GRP_LABEL=$(printf '%s' "$GRP_LABEL" | tr -cd 'A-Za-z0-9_-')

if [ -n "$GRP_LABEL" ]; then
  # grp plans must carry the scenarios_updated field (the worktree agent
  # records it — an empty array is fine, but absence means the agent didn't
  # run the feature-file step).
  HAS_SCENARIOS=$(python3 -c "import json; d=json.load(open('$BREADCRUMB')); print('scenarios_updated' in d)" 2>/dev/null)
  if [ "$HAS_SCENARIOS" != "True" ]; then
    echo "{\"decision\":\"block\",\"reason\":\"Action $FID (grp:$GRP_LABEL) breadcrumb is missing the scenarios_updated field. The /execute-group worktree agent records it (empty array if no e2e/features files were affected). Re-run /execute-group $GRP_LABEL so the field is written.\"}"
    exit 0
  fi

  REPORT="$VERIFY_DIR/group-$GRP_LABEL-report.json"

  if [ ! -f "$REPORT" ]; then
    echo "{\"decision\":\"block\",\"reason\":\"Action $FID carries grp:$GRP_LABEL but its Completion Report is missing ($REPORT). Grouped plans are completed by /execute-group, which writes the report after running cabinet checkpoints and marks merged plans done itself. To complete: run /execute-group $GRP_LABEL. If you are completing this plan outside the group flow, remove the grp:$GRP_LABEL tag from its tags first.\"}"
    exit 0
  fi

  VERDICT=$(python3 -c "
import json
try:
    d = json.load(open('$REPORT'))
    pp = d.get('per_plan', [])
    me = next((p for p in pp if isinstance(p, dict) and p.get('fid') == '$FID'), None)
    cks = d.get('checkpoints', {}) or {}
    integ = cks.get('integration', {}) or {}
    cp3g = cks.get('cp3_group', '')
    if me is None: print('NOT_IN_REPORT')
    elif me.get('status') != 'merged': print('plan-status=' + str(me.get('status')))
    elif cp3g not in ('continue', 'skipped', 'n/a'): print('cp3_group=' + str(cp3g))
    elif integ.get('validate') != 'pass': print('integration.validate=' + str(integ.get('validate')))
    elif integ.get('breadcrumbs') != 'valid': print('integration.breadcrumbs=' + str(integ.get('breadcrumbs')))
    else: print('OK')
except Exception:
    print('REPORT_UNREADABLE')
" 2>/dev/null)

  if [ "$VERDICT" != "OK" ]; then
    echo "{\"decision\":\"block\",\"reason\":\"Action $FID (grp:$GRP_LABEL) is not cleared by its Completion Report: $VERDICT. The report must show this plan with status=merged, checkpoints.cp3_group=continue, integration.validate=pass, and integration.breadcrumbs=valid. Inspect it: cat $REPORT . If the group run did not finish cleanly, re-run /execute-group $GRP_LABEL; do not force-complete a plan the workflow parked or that failed integration.\"}"
    exit 0
  fi
fi

exit 0
