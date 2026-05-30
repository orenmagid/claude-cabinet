# Validators

Each validator is a named check with a command. The /validate skill
reads this file and executes each check in sequence, collating pass/fail
summary at the end.

## Format

For each validator:
- **Name** — short label for the summary table
- **Command** — shell command that returns exit 0 on success, non-zero on failure
- **What it catches** — brief description

## Active Validators

### skill-structure

```bash
bash scripts/skill-validator.sh templates/skills/*/SKILL.md .claude/skills/*/SKILL.md
```

Catches SKILL.md files that violate the best practices encoded in
`.claude/cabinet/skill-best-practices.md` — line count over 500, missing
or malformed name/description, broken reference depth, backslash paths,
and skill-type-specific rules (workflow vs cabinet). Fast (<5s for 50
skills). Runs every /validate invocation.

### manifest-drift

```bash
node scripts/cc-drift-check.cjs
```

Catches files listed in `.ccrc.json` that have been locally modified
relative to their upstream hashes. Flags files that should be updated
through the installer rather than edited in place.

### cabinet-structure

```bash
errors=0
for skill_dir in .claude/skills/cabinet-*/; do
  file="$skill_dir/SKILL.md"
  [ -f "$file" ] || continue
  name=$(basename "$skill_dir")

  if ! grep -q '^tools:' "$file" 2>/dev/null; then
    echo "WARN: $name missing 'tools:' frontmatter"
    errors=$((errors + 1))
  fi

  if ! grep -q '## Investigation Protocol' "$file" 2>/dev/null; then
    if ! grep -q '## Research Method' "$file" 2>/dev/null; then
      echo "WARN: $name missing Investigation Protocol or Research Method section"
      errors=$((errors + 1))
    fi
  fi

  if ! grep -q '## Portfolio Boundaries' "$file" 2>/dev/null; then
    echo "WARN: $name missing Portfolio Boundaries section"
    errors=$((errors + 1))
  fi

  if ! grep -q '## Calibration Examples' "$file" 2>/dev/null; then
    echo "WARN: $name missing Calibration Examples section"
    errors=$((errors + 1))
  fi

  if ! grep -q '## Historically Problematic Patterns' "$file" 2>/dev/null; then
    echo "WARN: $name missing Historically Problematic Patterns section"
    errors=$((errors + 1))
  fi
done

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "$errors structural warnings found across cabinet members."
  echo "See .claude/cabinet/_cabinet-member-template.md for required structure."
  exit 1
fi
echo "All cabinet members pass structural validation."
```

Catches cabinet members missing required sections (Investigation
Protocol, Portfolio Boundaries, Calibration Examples, Historically
Problematic Patterns) or frontmatter fields (tools). Complements
skill-structure — that one is mechanical; this one checks sectional
structure specific to cabinet members.

### memory-structure

```bash
node scripts/validate-memory.mjs --quiet
```

Catches MEMORY.md exceeding session-start budget (200 lines / 25KB),
orphan memory files not indexed in MEMORY.md, broken references to
files that don't exist, and oversized topic-style files (>50KB).
Skips silently if the project has no memory directory yet.

### checkpoint-protocol-reference

```bash
proto="templates/cabinet/checkpoint-protocol.md"
[ -f ".claude/cabinet/checkpoint-protocol.md" ] && proto=".claude/cabinet/checkpoint-protocol.md"
[ -f "$proto" ] || { echo "checkpoint-protocol.md not present — skipping"; exit 0; }

errors=0
for name in execute execute-group; do
  f="templates/skills/$name/SKILL.md"
  [ -f "$f" ] || f=".claude/skills/$name/SKILL.md"
  [ -f "$f" ] || continue
  # Require BOTH the filename and the imperative read-phrase. Checking
  # only the filename would let a re-inline that keeps a stray
  # "see checkpoint-protocol.md" comment pass while dropping the actual
  # read-instruction — that is still drift.
  if ! grep -q "checkpoint-protocol.md" "$f" || ! grep -q "follow it, scoped to" "$f"; then
    echo "WARN: $name/SKILL.md no longer reads cabinet/checkpoint-protocol.md (missing filename or 'follow it, scoped to' instruction)"
    errors=$((errors + 1))
  fi
done

if [ "$errors" -gt 0 ]; then
  echo "$errors skill(s) dropped the checkpoint-protocol read-instruction."
  echo "Cabinet checkpoints rely on it — re-add the 'Read checkpoint-protocol.md and follow it, scoped to ...' step."
  exit 1
fi
echo "Checkpoint-protocol references intact."
```

Catches drift-by-deletion: `/execute` and `/execute-group` must each
read `cabinet/checkpoint-protocol.md` rather than inline (and silently
diverge from) the checkpoint mechanism. If a skill stops referencing the
protocol, its checkpoints have either been re-inlined or dropped — both
are drift. Skips silently if the protocol file isn't present (e.g., a
project that hasn't adopted the split yet).

## Example Validators (commented — enable for your project)

<!--
### Type Check
```bash
cd your-app-dir && npx tsc --noEmit
```
Catches type errors before they reach production.

### Lint
```bash
cd your-app-dir && npx eslint src/
```
Catches style violations and common code quality issues.

### Production Build
```bash
cd your-app-dir && npx vite build
```
Catches what the type checker misses: bare catch blocks, runtime-only
errors, bundle resolution failures. A type check pass + build fail =
broken deploy.

### Structural Validation
```bash
./scripts/validate-structure.sh
```
Project-specific structural checks (e.g., required files exist,
cross-references are valid, configuration is consistent).

### Memory/Docs Validation
```bash
./scripts/validate-docs.sh
```
Checks that documentation references (memory index, CLAUDE.md links)
point to files that actually exist.
-->
