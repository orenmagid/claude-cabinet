#!/bin/bash
# Claude on Rails — shell installer
# Works without Node.js, npm, or git — installs them if needed.
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
VERSION="0.5.4"
TARBALL_URL="https://registry.npmjs.org/create-claude-rails/-/create-claude-rails-${VERSION}.tgz"

echo ""
echo "  🚂 Claude on Rails v${VERSION}"
echo ""

# --- Install prerequisites ---
HAS_BREW=false
command -v brew >/dev/null 2>&1 && HAS_BREW=true

install_via_brew() {
  tool="$1"
  if [ "$HAS_BREW" = false ]; then
    echo "  First, installing Homebrew (a package manager for your Mac)."
    echo "  It may ask for your password — that's normal."
    echo ""
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/tty
    # Homebrew may not be in PATH yet
    if [ -f /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -f /usr/local/bin/brew ]; then
      eval "$(/usr/local/bin/brew shellenv)"
    fi
    command -v brew >/dev/null 2>&1 && HAS_BREW=true
  fi
  if [ "$HAS_BREW" = true ]; then
    brew install "$tool" 2>&1 | sed 's/^/  /'
    return $?
  else
    echo "  ⚠ Could not install Homebrew. Please install $tool manually and re-run."
    return 1
  fi
}

# Git: version control. Every project should have it.
if ! command -v git >/dev/null 2>&1; then
  echo "  Installing git (version control — keeps a history of your work)..."
  install_via_brew git
  echo ""
fi

# Node.js: needed for work tracking database
if ! command -v node >/dev/null 2>&1; then
  echo "  Installing Node.js (needed for task tracking)..."
  install_via_brew node
  echo ""
fi

# Initialize git repo if this folder doesn't have one
if command -v git >/dev/null 2>&1 && [ ! -d "$PROJECT_DIR/.git" ]; then
  git -C "$PROJECT_DIR" init -q
  echo "  ✓ Initialized git repository"
  echo ""
fi

# --- User identity (global, first time only) ---
CLAUDE_HOME="$HOME/.claude"
mkdir -p "$CLAUDE_HOME"

FIRST_COR_INSTALL=false
if [ ! -f "$CLAUDE_HOME/cor-registry.json" ]; then
  FIRST_COR_INSTALL=true
fi

if [ "$FIRST_COR_INSTALL" = true ] && [ ! -s "$CLAUDE_HOME/CLAUDE.md" ]; then
  echo "  This looks like your first time using Claude on Rails."
  echo "  Let's set up your profile so Claude knows who you are"
  echo "  across all your projects."
  echo ""
  printf "  What's your name? "
  read -r USER_NAME </dev/tty 2>/dev/null || USER_NAME=""
  printf "  What do you do? (e.g. \"I run a bakery\", \"I'm a freelance designer\") "
  read -r USER_ROLE </dev/tty 2>/dev/null || USER_ROLE=""

  if [ -n "$USER_NAME" ] || [ -n "$USER_ROLE" ]; then
    # Append to CLAUDE.md (don't overwrite if it has other content)
    {
      echo ""
      echo "# About Me"
      echo ""
      [ -n "$USER_NAME" ] && echo "Name: $USER_NAME"
      [ -n "$USER_ROLE" ] && echo "$USER_ROLE"
      echo ""
      echo "<!-- Added by Claude on Rails. Claude sees this in every project. -->"
      echo "<!-- Edit ~/.claude/CLAUDE.md to update. -->"
    } >> "$CLAUDE_HOME/CLAUDE.md"
    echo ""
    echo "  ✓ Saved your profile to ~/.claude/CLAUDE.md"
    echo "    Claude will know this in every project you open."
    echo ""
  else
    echo ""
    echo "  (Skipped — you can set this up later in ~/.claude/CLAUDE.md)"
    echo ""
  fi
fi

# --- Project registry (global) ---
REGISTRY_FILE="$CLAUDE_HOME/cor-registry.json"

# Ask for project name and description
PROJECT_NAME=$(basename "$PROJECT_DIR")
PROJECT_DESC=""

if [ ! -f "$PROJECT_DIR/.corrc.json" ]; then
  printf "  What's this project called? [%s] " "$PROJECT_NAME"
  read -r input_name </dev/tty 2>/dev/null || input_name=""
  [ -n "$input_name" ] && PROJECT_NAME="$input_name"

  printf "  One line about what it is: "
  read -r PROJECT_DESC </dev/tty 2>/dev/null || PROJECT_DESC=""
  echo ""
fi

# Update the registry
if command -v node >/dev/null 2>&1; then
  # Use Node for reliable JSON manipulation
  node -e "
    const fs = require('fs');
    const reg = fs.existsSync('$REGISTRY_FILE')
      ? JSON.parse(fs.readFileSync('$REGISTRY_FILE', 'utf8'))
      : { projects: [] };
    const existing = reg.projects.findIndex(p => p.path === '$PROJECT_DIR');
    const entry = {
      path: '$PROJECT_DIR',
      name: $(printf '%s' "$PROJECT_NAME" | node -e "process.stdout.write(JSON.stringify(require('fs').readFileSync('/dev/stdin','utf8')))"),
      description: $(printf '%s' "$PROJECT_DESC" | node -e "process.stdout.write(JSON.stringify(require('fs').readFileSync('/dev/stdin','utf8')))"),
      version: '$VERSION',
      updatedAt: new Date().toISOString()
    };
    if (existing >= 0) {
      // Preserve description if not re-entered
      if (!entry.description) entry.description = reg.projects[existing].description;
      reg.projects[existing] = entry;
    } else {
      reg.projects.push(entry);
    }
    fs.writeFileSync('$REGISTRY_FILE', JSON.stringify(reg, null, 2) + '\\n');
  " 2>/dev/null

  # Count other projects
  if [ -f "$REGISTRY_FILE" ]; then
    OTHER_COUNT=$(node -e "
      const reg = JSON.parse(require('fs').readFileSync('$REGISTRY_FILE','utf8'));
      console.log(reg.projects.filter(p => p.path !== '$PROJECT_DIR').length);
    " 2>/dev/null)
    if [ "$OTHER_COUNT" -gt 0 ] 2>/dev/null; then
      echo "  ✓ Registered in project registry ($OTHER_COUNT other project(s))"
    else
      echo "  ✓ Registered in project registry"
    fi
  fi
else
  # Without Node, write a simple registry
  echo "{\"projects\":[{\"path\":\"$PROJECT_DIR\",\"name\":\"$PROJECT_NAME\",\"version\":\"$VERSION\"}]}" > "$REGISTRY_FILE"
  echo "  ✓ Registered in project registry"
fi

# --- Check for existing install ---
EXISTING_INSTALL=false
if [ -f "$PROJECT_DIR/.corrc.json" ]; then
  EXISTING_INSTALL=true
  OLD_VERSION=$(grep '"version"' "$PROJECT_DIR/.corrc.json" 2>/dev/null | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')
  echo "  Existing installation found (v${OLD_VERSION:-unknown})"
  echo "  Updating to v${VERSION}..."
  echo ""
fi

# --- Download templates ---
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "  Downloading..."
curl -fsSL "$TARBALL_URL" | tar xz -C "$TMPDIR" 2>/dev/null
TEMPLATE_DIR="$TMPDIR/package/templates"

if [ ! -d "$TEMPLATE_DIR" ]; then
  echo "  Error: download failed. Check your internet connection and try again."
  exit 1
fi

# --- Install everything ---
echo "  Setting up..."

# All skill directories
SKILL_DIRS="orient orient-quick debrief debrief-quick menu plan execute investigate audit pulse triage-audit perspectives onboard seed cor-upgrade link unlink publish extract validate"

# Copy skills
copied=0
for skill in $SKILL_DIRS; do
  src="$TEMPLATE_DIR/skills/$skill"
  dst="$CLAUDE_DIR/skills/$skill"
  if [ -d "$src" ]; then
    skip_phases=false
    case "$skill" in
      orient|debrief|plan|execute|audit|pulse|investigate|validate|triage-audit)
        skip_phases=true
        ;;
    esac

    mkdir -p "$dst"
    if [ "$skip_phases" = true ]; then
      find "$src" -maxdepth 1 -type f | while read -r f; do
        cp "$f" "$dst/"
        copied=$((copied + 1))
      done
    else
      cp -R "$src"/* "$dst/" 2>/dev/null || true
      copied=$((copied + $(find "$src" -type f | wc -l | tr -d ' ')))
    fi

    if [ "$skill" = "debrief" ] && [ -f "$src/phases/upstream-feedback.md" ]; then
      mkdir -p "$dst/phases"
      cp "$src/phases/upstream-feedback.md" "$dst/phases/"
      copied=$((copied + 1))
    fi
  fi
done

# Copy hooks
mkdir -p "$CLAUDE_DIR/hooks"
for hook in cor-upstream-guard.sh git-guardrails.sh skill-telemetry.sh skill-tool-telemetry.sh; do
  if [ -f "$TEMPLATE_DIR/hooks/$hook" ]; then
    cp "$TEMPLATE_DIR/hooks/$hook" "$CLAUDE_DIR/hooks/"
    chmod 755 "$CLAUDE_DIR/hooks/$hook"
    copied=$((copied + 1))
  fi
done
if [ -f "$TEMPLATE_DIR/hooks/stop-hook.md" ]; then
  cp "$TEMPLATE_DIR/hooks/stop-hook.md" "$CLAUDE_DIR/hooks/"
  copied=$((copied + 1))
fi

# Copy scripts
mkdir -p "$PROJECT_DIR/scripts"
for script in cor-drift-check.cjs finding-schema.json load-triage-history.js merge-findings.js pib-db.js pib-db-schema.sql triage-server.mjs triage-ui.html; do
  if [ -f "$TEMPLATE_DIR/scripts/$script" ]; then
    cp "$TEMPLATE_DIR/scripts/$script" "$PROJECT_DIR/scripts/"
    copied=$((copied + 1))
  fi
done

# Copy rules
mkdir -p "$CLAUDE_DIR/rules"
if [ -f "$TEMPLATE_DIR/rules/enforcement-pipeline.md" ]; then
  cp "$TEMPLATE_DIR/rules/enforcement-pipeline.md" "$CLAUDE_DIR/rules/"
  copied=$((copied + 1))
fi

# Copy memory patterns
mkdir -p "$CLAUDE_DIR/memory/patterns"
for memfile in _pattern-template.md pattern-intelligence-first.md; do
  if [ -f "$TEMPLATE_DIR/memory/patterns/$memfile" ]; then
    cp "$TEMPLATE_DIR/memory/patterns/$memfile" "$CLAUDE_DIR/memory/patterns/"
    copied=$((copied + 1))
  fi
done

echo "  ✓ Installed $copied files"

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
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/git-guardrails.sh"
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
  echo "  ✓ Configured settings"
fi

# --- Initialize work tracking database ---
if command -v node >/dev/null 2>&1 && [ -f "$PROJECT_DIR/scripts/pib-db.js" ]; then
  if [ ! -f "$PROJECT_DIR/pib.db" ]; then
    node "$PROJECT_DIR/scripts/pib-db.js" init 2>/dev/null && echo "  ✓ Created task database" || true
  fi
fi

# --- Clean up files removed upstream ---
if [ "$EXISTING_INSTALL" = true ]; then
  removed=0
  grep -o '"[^"]*": "[a-f0-9]*"' "$PROJECT_DIR/.corrc.json" 2>/dev/null | while read -r line; do
    oldfile=$(echo "$line" | sed 's/"\([^"]*\)".*/\1/')
    case "$oldfile" in
      version|installedAt|upstreamPackage) continue ;;
      .claude/settings.json) continue ;;
    esac
    fullpath="$PROJECT_DIR/$oldfile"
    if [ -f "$fullpath" ]; then
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
    echo "  ✓ Cleaned up $removed old file(s)"
  fi
fi

# --- Build manifest ---
build_manifest() {
  echo "{"
  echo '  "version": "'"$VERSION"'",'
  echo '  "installedAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",'
  echo '  "upstreamPackage": "create-claude-rails",'
  echo '  "modules": {'
  echo '    "session-loop": true,'
  echo '    "hooks": true,'
  echo '    "work-tracking": true,'
  echo '    "planning": true,'
  echo '    "compliance": true,'
  echo '    "audit": true,'
  echo '    "lifecycle": true,'
  echo '    "validate": true'
  echo '  },'
  echo '  "skipped": {},'
  echo '  "manifest": {'

  first=true
  find_paths="$CLAUDE_DIR"
  [ -d "$PROJECT_DIR/scripts" ] && find_paths="$find_paths $PROJECT_DIR/scripts"
  find $find_paths -type f 2>/dev/null | sort | while read -r filepath; do
    relpath="${filepath#$PROJECT_DIR/}"
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

# --- Done ---
echo ""
echo "  ✅ All set!"
echo ""
echo "  Here's what to do next:"
echo ""
echo "  1. Open Claude Code in this folder"
echo "     (Open the app and drag this folder in, or run 'claude' in terminal)"
echo ""
echo "  2. Type:  /onboard"
echo "     Claude will ask about your project. Just answer the questions."
echo "     There are no wrong answers — it adapts to you."
echo ""
echo "  3. That's it! After onboarding, use:"
echo "     /orient   — at the start of each work session"
echo "     /debrief  — at the end of each work session"
echo "     /menu     — to see everything else you can do"
echo ""
echo "  Have other projects? Run this installer in each project folder."
echo "  Claude will know about all of them and how they connect."
echo ""
