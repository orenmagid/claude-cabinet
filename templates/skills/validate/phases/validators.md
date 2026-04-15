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
