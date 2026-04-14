#!/usr/bin/env python3
"""Migrate flat .claude/memory/*.md files to omega semantic memory.

Usage: python3 migrate-memory-to-omega.py [--dry-run] [--memory-dir PATH]

Features:
- Detects memory type from filename/content heuristics
- Tags memories with source project name
- Checks for near-duplicates before storing (skips if similar exists)
- Renames migrated files to .md.migrated (idempotent)
"""

import argparse, json, os, subprocess, sys
from pathlib import Path

OMEGA_BIN = os.path.expanduser("~/.claude-cabinet/omega-venv/bin/omega")

TYPE_HEURISTICS = {
    "decision": ["decision", "chose", "decided", "went with", "picked"],
    "lesson_learned": ["lesson", "learned", "mistake", "gotcha", "never again"],
    "user_preference": ["prefer", "preference", "always", "never", "style"],
    "constraint": ["constraint", "limitation", "can't", "must not", "blocked"],
    "error_pattern": ["error", "bug", "broke", "failed", "crash"],
}

def detect_project():
    """Get project name from package.json or directory name."""
    try:
        with open("package.json") as f:
            pkg = json.load(f)
        return pkg.get("name", Path.cwd().name)
    except Exception:
        return Path.cwd().name

def detect_type(filename, content):
    text = (filename + " " + content).lower()
    scores = {t: sum(1 for kw in kws if kw in text) for t, kws in TYPE_HEURISTICS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "decision"

def check_duplicate(content):
    """Query omega for similar memories. Returns True if near-dup found."""
    try:
        query = content[:200].replace('"', '\\"').replace("\n", " ")
        result = subprocess.run(
            [OMEGA_BIN, "query", query, "--limit", "3"],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode != 0 or not result.stdout.strip():
            return False
        content_words = set(content.lower().split())
        for line in result.stdout.strip().split("\n"):
            line_words = set(line.lower().split())
            if len(content_words & line_words) > 0.6 * min(len(content_words), len(line_words)):
                return True
        return False
    except Exception:
        return False

def migrate_file(filepath, project_name, dry_run=False):
    content = filepath.read_text(encoding="utf-8").strip()
    if not content:
        return "empty", "Skipped — empty file"

    mtype = detect_type(filepath.name, content)
    tagged_content = f"[source: {project_name}] {content}"

    if dry_run:
        return "dry_run", f"Would store as {mtype} from {project_name}: {filepath.name}"

    if check_duplicate(content):
        return "duplicate", f"Near-duplicate found in omega — skipping: {filepath.name}"

    try:
        result = subprocess.run(
            [OMEGA_BIN, "store", "--type", mtype, "--text", tagged_content],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            migrated = filepath.with_suffix(".md.migrated")
            filepath.rename(migrated)
            return "migrated", f"Stored as {mtype}, renamed to {migrated.name}"
        else:
            return "error", f"omega store failed: {result.stderr.strip()}"
    except Exception as e:
        return "error", f"Exception: {e}"

def main():
    parser = argparse.ArgumentParser(description="Migrate flat memory files to omega")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be migrated without doing it")
    parser.add_argument("--memory-dir", default=".claude/memory", help="Path to memory directory")
    args = parser.parse_args()

    if not os.path.exists(OMEGA_BIN):
        print(f"ERROR: Omega not found at {OMEGA_BIN}")
        sys.exit(1)

    memory_dir = Path(args.memory_dir)
    if not memory_dir.exists():
        print(f"No memory directory at {memory_dir}")
        sys.exit(0)

    # Skip MEMORY.md, patterns/, and already-migrated files
    md_files = [f for f in sorted(memory_dir.glob("**/*.md"))
                if f.name != "MEMORY.md" and "/patterns/" not in str(f)]
    if not md_files:
        print("No .md files to migrate.")
        sys.exit(0)

    project = detect_project()
    print(f"Migrating {len(md_files)} files from project '{project}'")
    if args.dry_run:
        print("DRY RUN\n")

    counts = {}
    for f in md_files:
        status, msg = migrate_file(f, project, args.dry_run)
        counts[status] = counts.get(status, 0) + 1
        print(f"  [{status}] {f.name}: {msg}")

    print(f"\nDone. {counts}")

if __name__ == "__main__":
    main()
