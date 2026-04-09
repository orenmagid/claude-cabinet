# Validators

Define your project-specific validation checks here. Each validator is
a named check with a command to run. The /validate skill reads this file
and executes each check in sequence.

## Format

For each validator, provide:
- **Name** — short label for the summary table
- **Command** — shell command that returns exit 0 on success, non-zero on failure
- **What it catches** — brief description of what this validator detects

## Example Validators

Uncomment and adapt these for your project:

### Cabinet Member Structure
```bash
# Check all cabinet members for required sections and frontmatter
errors=0
for skill_dir in .claude/skills/cabinet-*/; do
  file="$skill_dir/SKILL.md"
  [ -f "$file" ] || continue
  name=$(basename "$skill_dir")

  # Required frontmatter: tools field
  if ! grep -q '^tools:' "$file" 2>/dev/null; then
    echo "WARN: $name missing 'tools:' frontmatter"
    errors=$((errors + 1))
  fi

  # Required section: Investigation Protocol (or Research Method for legacy)
  if ! grep -q '## Investigation Protocol' "$file" 2>/dev/null; then
    if ! grep -q '## Research Method' "$file" 2>/dev/null; then
      echo "WARN: $name missing Investigation Protocol or Research Method section"
      errors=$((errors + 1))
    fi
  fi

  # Required section: Portfolio Boundaries
  if ! grep -q '## Portfolio Boundaries' "$file" 2>/dev/null; then
    echo "WARN: $name missing Portfolio Boundaries section"
    errors=$((errors + 1))
  fi

  # Required section: Calibration Examples
  if ! grep -q '## Calibration Examples' "$file" 2>/dev/null; then
    echo "WARN: $name missing Calibration Examples section"
    errors=$((errors + 1))
  fi

  # Required section: Historically Problematic Patterns
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
Catches cabinet members missing required sections (Investigation Protocol,
Portfolio Boundaries, Calibration Examples, Historically Problematic
Patterns) or frontmatter fields (tools). Warns but doesn't block —
legacy members with Research Method instead of Investigation Protocol
are accepted.

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
Project-specific structural checks (e.g., required files exist, cross-references
are valid, configuration is consistent). Write these scripts for your
project's invariants.

### Memory/Docs Validation
```bash
./scripts/validate-docs.sh
```
Checks that documentation references (memory index, CLAUDE.md links) point
to files that actually exist.
-->
