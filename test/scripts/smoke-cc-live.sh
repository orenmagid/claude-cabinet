#!/usr/bin/env bash
# Phase 1 smoke test against the LIVE omega DB on this machine.
# Writes to a temp dir (never touches ~/.claude/projects/<slug>/memory/).
# Verifies content-hash invariant: every omega memory ID appears in output.
#
# Exit 0 = pass. Non-zero = fail with reason.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OMEGA_BIN="$HOME/.claude-cabinet/omega-venv/bin/omega"

if [ ! -x "$OMEGA_BIN" ]; then
  echo "SKIP: omega not installed at $OMEGA_BIN" >&2
  exit 0
fi

SMOKE_OUT=$(mktemp -d)
trap "rm -rf '$SMOKE_OUT'" EXIT

cd "$REPO_ROOT"

EXPORT_DIR="$SMOKE_OUT/raw-export"
"$OMEGA_BIN" export-obsidian --output-dir "$EXPORT_DIR" >/dev/null

OMEGA_IDS=$(find "$EXPORT_DIR/omega-memories" -name 'mem-*.md' -type f \
  -exec basename {} .md \; | sort -u)
OMEGA_COUNT=$(echo "$OMEGA_IDS" | wc -l | tr -d ' ')

node -e "
const { migrateFromOmega } = require('./lib/migrate-from-omega');
migrateFromOmega({ dryRun: false, outputDir: '$SMOKE_OUT/memory' })
  .then(r => {
    console.log(JSON.stringify({
      migrated: r.migrated,
      edges: r.edges,
      topicFiles: r.topicFiles ? r.topicFiles.length : 0,
      currentProject: r.currentProject,
      reason: r.reason || null,
    }, null, 2));
  })
  .catch(e => { console.error('migrateFromOmega failed:', e.message); process.exit(1); });
" > "$SMOKE_OUT/result.json"

cat "$SMOKE_OUT/result.json"

PRESENT_IDS=$(grep -hoE 'mem-[a-f0-9]+' "$SMOKE_OUT/memory/"*.md 2>/dev/null | sort -u)
MISSING=$(comm -23 <(echo "$OMEGA_IDS") <(echo "$PRESENT_IDS"))
MISSING_COUNT=$(echo -n "$MISSING" | grep -c '^mem-' || true)

if [ "$MISSING_COUNT" -gt 0 ]; then
  echo "FAIL: $MISSING_COUNT of $OMEGA_COUNT memory IDs missing from migration output" >&2
  echo "$MISSING" | head -10 >&2
  exit 1
fi

LINES=$(wc -l < "$SMOKE_OUT/memory/MEMORY.md")
BYTES=$(wc -c < "$SMOKE_OUT/memory/MEMORY.md" | tr -d ' ')
if [ "$LINES" -gt 200 ] || [ "$BYTES" -gt 25000 ]; then
  echo "FAIL: MEMORY.md exceeds caps ($LINES lines / $BYTES bytes; caps: 200 / 25000)" >&2
  exit 1
fi

OVERSIZED=0
for f in "$SMOKE_OUT/memory/"*.md; do
  bytes=$(wc -c < "$f" | tr -d ' ')
  if [ "$bytes" -gt 50000 ]; then
    echo "FAIL: $(basename "$f") is $bytes bytes (>50KB cap)" >&2
    OVERSIZED=$((OVERSIZED + 1))
  fi
done

if [ "$OVERSIZED" -gt 0 ]; then
  exit 1
fi

echo "PASS: $OMEGA_COUNT memories migrated; all IDs present; MEMORY.md within caps; no topic file exceeds 50KB."
