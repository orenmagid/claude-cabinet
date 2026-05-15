#!/bin/bash
# Git Guardrails — PreToolUse hook for Bash tool calls
#
# Blocks truly destructive git operations on main. Allows routine solo-dev ops.
# Single enforcement point (replaces any deny list entries in settings.json).
#
# ROLLBACK: If this hook causes problems, comment out the PreToolUse entry
# in .claude/settings.json to disable it immediately.
#
# Hook contract:
#   Input: $CLAUDE_TOOL_INPUT has the tool use JSON with "command" field
#   Output: JSON on stdout with { "decision": "block", "reason": "..." }
#           when blocking. Otherwise empty stdout + exit 0 (Claude Code
#           treats no-output as allow; emitting "allow" violates the
#           hook output schema).

# Read the command from the tool input
COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('command',''))" 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Check if command contains git operations worth blocking
# Returns the block JSON if blocked, empty string if allowed
check_command() {
  local cmd="$1"

  # BLOCK: force push to main/master
  if echo "$cmd" | grep -qE 'git\s+push\s+.*--force(\s|$)' && echo "$cmd" | grep -qE '\b(main|master)\b'; then
    echo '{"decision":"block","reason":"Blocked: force push to main/master. Use --force-with-lease for safer force push, or push to a feature branch."}'
    return
  fi

  # BLOCK: bare force push (no explicit non-main branch)
  if echo "$cmd" | grep -qE 'git\s+push\s+(-f|--force)(\s|$)' && ! echo "$cmd" | grep -qE '--force-with-lease'; then
    # Allow if pushing to an explicitly named non-main branch
    if echo "$cmd" | grep -qE 'git\s+push\s+(-f|--force)\s+\S+\s+\S+' && ! echo "$cmd" | grep -qE '\b(main|master)\b'; then
      return  # explicit remote + non-main branch is OK
    fi
    echo '{"decision":"block","reason":"Blocked: git push --force without specifying a non-main branch. Use --force-with-lease or specify the branch explicitly."}'
    return
  fi

  # BLOCK: git reset --hard on main
  if echo "$cmd" | grep -qE 'git\s+reset\s+--hard'; then
    local current_branch
    current_branch=$(git branch --show-current 2>/dev/null)
    if [ "$current_branch" = "main" ] || [ "$current_branch" = "master" ]; then
      echo "{\"decision\":\"block\",\"reason\":\"Blocked: git reset --hard on $current_branch. This permanently discards commits. Switch to a feature branch first, or use git reset --soft.\"}"
      return
    fi
  fi

  # BLOCK: git clean -f (deletes untracked files permanently)
  if echo "$cmd" | grep -qE 'git\s+clean\s+-[a-zA-Z]*f'; then
    echo '{"decision":"block","reason":"Blocked: git clean -f permanently deletes untracked files. Use git clean -n (dry run) first to see what would be deleted."}'
    return
  fi
}

# Check the full command (handles compound commands since grep matches substrings)
RESULT=$(check_command "$COMMAND")

if [ -n "$RESULT" ]; then
  echo "$RESULT"
fi
exit 0
