# Maintain — Cabinet Health Review

Review existing cabinet members for health: retirement candidates, update
needs, and coverage gaps. The /seed skill reads this file after building
new cabinet members (or when no new cabinet members are needed).

When this file is absent or empty, the default behavior is: review the
full cabinet using the criteria below. To explicitly skip
maintenance, write only `skip: true`.

## What to Include

Define your maintenance strategy:
- **Retirement criteria** — what signals that a cabinet member should be removed
- **Update criteria** — what signals that a cabinet member needs revision
- **Coverage analysis** — how to detect areas of the codebase that no
  cabinet member watches
- **Presentation** — how to show recommendations to the user

## Default Maintenance Review

### Retirement Candidates

Check each cabinet member for retirement signals:

- **Technology removed.** The dependency, config file, or infrastructure
  that the cabinet member watches is gone from the project. A cabinet member
  for a framework you no longer use is dead weight.

- **High rejection rate.** If more than half of a cabinet member's audit
  findings are rejected at triage, it's miscalibrated. Either refine it
  (adjust scope, update calibration examples) or retire it if the domain
  isn't worth the maintenance.

- **Stale scan scope.** The directories or files the cabinet member checks
  no longer exist. The cabinet member runs but examines nothing.

- **Absorbed by another.** A broader cabinet member was created that covers
  the same concerns. The narrow one is now redundant.

Apply `_lifecycle.md` criteria for formal assessment. Recommend
retirements as readily as adoptions — a lean cabinet is healthier than
a comprehensive one with dead weight.

### Update Candidates

Check each cabinet member for update signals:

- **Version drift.** The technology version changed significantly
  (major version bump, breaking changes). The cabinet member's calibration
  examples and research method may reference outdated patterns.

- **Scope expansion needed.** New directories were added that fall under
  the cabinet member's domain but aren't in its scan scope. For example,
  a security cabinet member that scans `routes/` but the project added an
  `api/` directory with new endpoints.

- **New features.** The technology added capabilities that the project
  now uses but the cabinet member doesn't check. For example, SQLite added
  JSON functions that the project started using — the data-integrity
  cabinet member should know about JSON type coercion.

### Coverage Gaps

Scan the codebase for areas no cabinet member watches:

- Directories with significant logic that aren't in any cabinet member's
  scan scope
- File types that have grown in number but lack a corresponding
  cabinet member (e.g., many migration files but no migration-safety
  cabinet member)
- Patterns that recur across the codebase that no cabinet member checks
  (e.g., error handling patterns, logging patterns)

### Presentation

Present maintenance recommendations as three lists:

1. **Retire** — cabinet members to remove, with reasoning
2. **Update** — cabinet members to revise, with specific changes needed
3. **Gap** — uncovered areas that might warrant new cabinet members

The user decides on each recommendation. Retirement is not failure —
it's the system staying lean.

## Overriding This Phase

Projects override this file when they have additional maintenance
criteria (e.g., cost tracking for cabinet members, team assignment
reviews), different retirement thresholds, or non-standard health
metrics. For example, a project that tracks cabinet member ROI based on
bugs caught per audit cycle.
