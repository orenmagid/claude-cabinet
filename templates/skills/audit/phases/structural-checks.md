# Structural Checks — Fast Deterministic Validation

Define fast, deterministic checks to run before the full cabinet member-based
audit. The /audit skill reads this file after cabinet member selection.

When this file is absent or empty, structural checks are skipped. Most
projects start without them and add checks as they discover invariants
worth verifying automatically. To explicitly skip, write only `skip: true`.

## What to Include

For each check, provide:
- **What** — the command or script to run
- **Why** — what invariant it verifies
- **On failure** — how to surface the result (block audit, warn, or note)

Structural checks should be fast (seconds, not minutes) and deterministic
(same input always produces same output). They complement the AI-driven
cabinet member audit with mechanical verification.

## Example Checks

Uncomment and adapt for your project:

<!--
### Type Checking
```bash
npx tsc --noEmit
```
Catches type errors that cabinet members might miss or waste time on.
On failure: include type errors in the audit report as pre-findings.

### Lint
```bash
npx eslint src/ --format json
```
Catches style violations so cabinet members can focus on deeper issues.
On failure: summarize violations, don't block audit.

### Validation Scripts
```bash
node scripts/validate-structure.sh
```
Project-specific structural invariants (e.g., every module has tests,
every API endpoint has documentation, every entity type has a schema).
On failure: include as findings with source "structural-check".

### Dependency Audit
```bash
npm audit --json
```
Known vulnerability scan before the security cabinet member runs.
On failure: include as pre-findings for the security cabinet member.
-->
