#!/usr/bin/env bash
# cc-site-audit runtime installer
#
# Installs the @claude-cabinet/site-audit npm package to
# ~/.claude-cabinet/site-audit/<version>/ and writes a current/VERSION
# pointer, mirroring the cabinet-verify runtime pattern.
#
# ⚠️  HEREDOC QUOTING: if you edit heredocs below, ensure apostrophe
# and backtick counts are balanced inside the quoted delimiter. Unbalanced
# quotes silently break the heredoc boundary and cost ~15min of bisecting.
# See: feedback/2026-05-17-bash-heredoc-trap-in-install-sh

set -euo pipefail

RUNTIME_SRC="$(cd "$(dirname "$0")/../../site-audit-runtime" && pwd)"
VERSION=$(node -e "process.stdout.write(require('$RUNTIME_SRC/package.json').version)")
INSTALL_DIR="$HOME/.claude-cabinet/site-audit/$VERSION"
CURRENT_DIR="$HOME/.claude-cabinet/site-audit/current"

echo "cc-site-audit runtime installer v${VERSION}"
echo "  source:  $RUNTIME_SRC"
echo "  target:  $INSTALL_DIR"

# Pack and install
mkdir -p "$INSTALL_DIR"

echo "  packing runtime..."
TARBALL=$(cd "$RUNTIME_SRC" && npm pack --pack-destination "$INSTALL_DIR" 2>/dev/null | tail -1)

echo "  installing..."
cd "$INSTALL_DIR"
npm install "$TARBALL" --production --no-save 2>/dev/null

# Symlink bin
mkdir -p "$INSTALL_DIR/bin"
if [ -f "$INSTALL_DIR/node_modules/@claude-cabinet/site-audit/bin/cc-site-audit" ]; then
  ln -sf "$INSTALL_DIR/node_modules/@claude-cabinet/site-audit/bin/cc-site-audit" "$INSTALL_DIR/bin/cc-site-audit"
  chmod +x "$INSTALL_DIR/bin/cc-site-audit"
fi

# Write version pointer
rm -rf "$CURRENT_DIR"
mkdir -p "$CURRENT_DIR"
echo "$VERSION" > "$CURRENT_DIR/VERSION"
ln -sf "$INSTALL_DIR/bin" "$CURRENT_DIR/bin"

echo "  installed: v${VERSION}"
echo ""

# Detect system tools
echo "System tool detection:"
MISSING=0

check_tool() {
  local name="$1"
  local cmd="$2"
  local install="$3"
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "  ✓ $name"
  else
    echo "  ✗ $name — install: $install"
    MISSING=$((MISSING + 1))
  fi
}

# Required
if command -v google-chrome >/dev/null 2>&1 || command -v chromium >/dev/null 2>&1 || command -v chromium-browser >/dev/null 2>&1; then
  echo "  ✓ Chrome/Chromium (required)"
else
  echo "  ✗ Chrome/Chromium (REQUIRED) — install Chrome or: brew install chromium"
  MISSING=$((MISSING + 1))
fi

check_tool "dig (DNS checks)" "dig" "usually pre-installed; macOS: built-in; Linux: apt install dnsutils"
check_tool "openssl (SSL cert)" "openssl" "usually pre-installed"
check_tool "curl (HTTP/2 detection)" "curl" "usually pre-installed"

# Optional
check_tool "testssl.sh (TLS depth)" "testssl.sh" "git clone https://github.com/testssl/testssl.sh && ln -s testssl.sh/testssl.sh /usr/local/bin/"
check_tool "nuclei (CVE scan)" "nuclei" "go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest"

echo ""
if [ "$MISSING" -gt 0 ]; then
  echo "  $MISSING tool(s) not found. Checks for missing tools will skip gracefully."
else
  echo "  All tools available."
fi
echo ""
echo "Run: cc-site-audit <url>"
echo "  or: cc-site-audit compare <url-a> <url-b>"
