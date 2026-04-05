#!/bin/bash
# Claude on Rails — shell installer
# Works without Node.js, npm, or git.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/orenmagid/claude-on-rails/main/install.sh | bash
#
# Or download and run:
#   bash install.sh
#   bash install.sh /path/to/project

set -e

# Where to install (default: current directory)
PROJECT_DIR="${1:-.}"
PROJECT_DIR="$(cd "$PROJECT_DIR" 2>/dev/null && pwd)"

CLAUDE_DIR="$PROJECT_DIR/.claude"
VERSION="0.5.1"
TARBALL_URL="https://registry.npmjs.org/create-claude-rails/-/create-claude-rails-${VERSION}.tgz"

echo ""
echo "  🚂 Claude on Rails v${VERSION}"
echo "  Shell installer (no Node.js required)"
echo ""

# Check for existing install
EXISTING_INSTALL=false
if [ -f "$PROJECT_DIR/.corrc.json" ]; then
  EXISTING_INSTALL=true
  OLD_VERSION=$(grep '"version"' "$PROJECT_DIR/.corrc.json" 2>/dev/null | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')
  echo "  Existing installation found (v${OLD_VERSION:-unknown})"
  echo "  Updating upstream-managed files..."
  echo ""
fi

# Create temp directory for download
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "  Downloading templates..."
curl -fsSL "$TARBALL_URL" | tar xz -C "$TMPDIR" 2>/dev/null
TEMPLATE_DIR="$TMPDIR/package/templates"

if [ ! -d "$TEMPLATE_DIR" ]; then
  echo "  Error: failed to download templates."
  exit 1
fi

# --- Module selection: lean install ---
# session-loop, hooks, planning, audit, lifecycle
# Skip: work-tracking, compliance, validate

# Skill directories to copy
SKILL_DIRS="orient debrief menu plan execute investigate audit pulse triage-audit perspectives onboard seed cor-upgrade link unlink publish extract"

# Individual hook/script files
HOOK_FILES="cor-upstream-guard.sh skill-telemetry.sh skill-tool-telemetry.sh"
HOOK_STOP="stop-hook.md"
SCRIPT_FILES="cor-drift-check.cjs finding-schema.json load-triage-history.js merge-findings.js triage-server.mjs triage-ui.html"

echo "  Installing lean modules..."

# --- Copy skills ---
copied=0
for skill in $SKILL_DIRS; do
  src="$TEMPLATE_DIR/skills/$skill"
  dst="$CLAUDE_DIR/skills/$skill"
  if [ -d "$src" ]; then
    # For skeleton skills (not perspectives, not instruction-bearing),
    # skip phases/ — they use defaults until /onboard creates them
    skip_phases=false
    case "$skill" in
      orient|debrief|plan|execute|audit|pulse|investigate|validate|triage-audit)
        skip_phases=true
        ;;
    esac

    mkdir -p "$dst"
    if [ "$skip_phases" = true ]; then
      # Copy everything except phases/
      find "$src" -maxdepth 1 -type f | while read -r f; do
        cp "$f" "$dst/"
        copied=$((copied + 1))
      done
    else
      # Copy everything recursively
      cp -R "$src"/* "$dst/" 2>/dev/null || true
      copied=$((copied + $(find "$src" -type f | wc -l | tr -d ' ')))
    fi

    # Always copy upstream-feedback.md for debrief (instruction-bearing)
    if [ "$skill" = "debrief" ] && [ -f "$src/phases/upstream-feedback.md" ]; then
      mkdir -p "$dst/phases"
      cp "$src/phases/upstream-feedback.md" "$dst/phases/"
      copied=$((copied + 1))
    fi
  fi
done

# --- Copy hooks (skip git-guardrails — no git assumed) ---
mkdir -p "$CLAUDE_DIR/hooks"
for hook in $HOOK_FILES; do
  if [ -f "$TEMPLATE_DIR/hooks/$hook" ]; then
    cp "$TEMPLATE_DIR/hooks/$hook" "$CLAUDE_DIR/hooks/"
    chmod 755 "$CLAUDE_DIR/hooks/$hook"
    copied=$((copied + 1))
  fi
done
if [ -f "$TEMPLATE_DIR/hooks/$HOOK_STOP" ]; then
  cp "$TEMPLATE_DIR/hooks/$HOOK_STOP" "$CLAUDE_DIR/hooks/"
  copied=$((copied + 1))
fi

# --- Copy scripts ---
mkdir -p "$PROJECT_DIR/scripts"
for script in $SCRIPT_FILES; do
  if [ -f "$TEMPLATE_DIR/scripts/$script" ]; then
    cp "$TEMPLATE_DIR/scripts/$script" "$PROJECT_DIR/scripts/"
    copied=$((copied + 1))
  fi
done

echo "  📁 Copied $copied files"

# --- Write settings.json ---
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
if [ ! -f "$SETTINGS_FILE" ]; then
  cat > "$SETTINGS_FILE" << 'SETTINGS'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/cor-upstream-guard.sh"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/skill-telemetry.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Skill",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/skill-tool-telemetry.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Check if substantive work was done without /debrief. If yes, prompt to run it."
          }
        ]
      }
    ]
  }
}
SETTINGS
  echo "  ⚙️  Created settings.json"
else
  echo "  ⚙️  settings.json already exists (skipped)"
fi

# --- Clean up files removed upstream ---
if [ "$EXISTING_INSTALL" = true ]; then
  removed=0
  # Extract file paths from old manifest and check if they still exist in new templates
  grep -o '"[^"]*": "[a-f0-9]*"' "$PROJECT_DIR/.corrc.json" 2>/dev/null | while read -r line; do
    oldfile=$(echo "$line" | sed 's/"\([^"]*\)".*/\1/')
    case "$oldfile" in
      version|installedAt|upstreamPackage) continue ;;
      .claude/settings.json) continue ;;
    esac
    fullpath="$PROJECT_DIR/$oldfile"
    # If the file exists locally but wasn't just copied (i.e., the template no longer has it)
    if [ -f "$fullpath" ]; then
      # Check if there's a corresponding template source
      # Map installed path back to template path
      case "$oldfile" in
        .claude/skills/*) tplpath="$TEMPLATE_DIR/skills/${oldfile#.claude/skills/}" ;;
        .claude/hooks/*) tplpath="$TEMPLATE_DIR/hooks/${oldfile#.claude/hooks/}" ;;
        scripts/*) tplpath="$TEMPLATE_DIR/scripts/${oldfile#scripts/}" ;;
        *) tplpath="" ;;
      esac
      if [ -n "$tplpath" ] && [ ! -f "$tplpath" ]; then
        rm "$fullpath"
        removed=$((removed + 1))
      fi
    fi
  done
  if [ "$removed" -gt 0 ]; then
    echo "  🧹 Removed $removed file(s) no longer in upstream"
  fi
fi

# --- Build manifest with hashes ---
build_manifest() {
  echo "{"
  echo '  "version": "'"$VERSION"'",'
  echo '  "installedAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",'
  echo '  "upstreamPackage": "create-claude-rails",'
  echo '  "modules": {'
  echo '    "session-loop": true,'
  echo '    "hooks": true,'
  echo '    "planning": true,'
  echo '    "audit": true,'
  echo '    "lifecycle": true'
  echo '  },'
  echo '  "skipped": {'
  echo '    "work-tracking": "Skipped by shell installer",'
  echo '    "compliance": "Skipped by shell installer",'
  echo '    "validate": "Skipped by shell installer"'
  echo '  },'
  echo '  "manifest": {'

  first=true
  # Hash all installed files
  find "$CLAUDE_DIR" "$PROJECT_DIR/scripts" -type f 2>/dev/null | sort | while read -r filepath; do
    # Get path relative to project dir
    relpath="${filepath#$PROJECT_DIR/}"
    # Skip settings.json (not a template file)
    case "$relpath" in
      .claude/settings.json) continue ;;
    esac
    hash=$(shasum -a 256 "$filepath" 2>/dev/null | cut -c1-16)
    if [ -n "$hash" ]; then
      if [ "$first" = true ]; then
        first=false
      else
        echo ","
      fi
      printf '    "%s": "%s"' "$relpath" "$hash"
    fi
  done

  echo ""
  echo "  }"
  echo "}"
}

build_manifest > "$PROJECT_DIR/.corrc.json"
echo "  📝 Created .corrc.json"

# --- Summary ---
echo ""
echo "  ✅ Claude on Rails installed!"
echo ""
echo "  Next steps:"
echo "  1. Open Claude Code in this directory"
echo "  2. Say: /onboard"
echo "  3. Start sessions with /orient"
echo "  4. End sessions with /debrief"
echo ""
