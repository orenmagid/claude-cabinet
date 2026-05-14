# /execute integration with cabinet-verify — verify-emit phase

**Contract: v0.x soft — may change before v1.0.** This phase enables
the `/verify` integration with `/execute`. It is a customization phase
(opt-in), copied into your project only when the `verify` module is
selected during `npx create-claude-cabinet`.

## What this phase does

When `/execute` runs a plan that contains a `## Verify Plan` section,
this phase writes the proposed feature-file edits alongside the
code change in the same execution pass. The goal: feature files
stay in sync with the product because the edit lands in the same
commit as the code that motivated it.

## No-op guards

This phase will exit silently in two cases — checked in order:

1. **The loaded plan has no `## Verify Plan` section.** Most plans
   (backend-only, refactors, deploy configs) won't have one. No warning,
   no log line.
2. **The project has no `e2e/features/` directory.** Same as the
   `/plan` integration phase — without the runtime installed, there
   are no feature files to edit. Skip entirely.

Detection:

```bash
test -d e2e/features
```

Both guards must pass before this phase emits any output or writes
any files.

## When this phase runs

Position: after the file-group implementation loop, before the
pre-commit cabinet sweep. The order matters — feature-file edits
should be in the working tree when cabinet members review the full
diff, so a security or QA cabinet member sees that the scenarios were
updated alongside the code.

## How to read the Verify Plan section

Parse the plan notes for `## Verify Plan`. Each entry under the
heading begins with `- features/<file>.feature:` followed by a verb
phrase. Verbs the parser recognizes:

- `ADD step after <anchor>` — insert a new step at a specific position
- `MODIFY step <checkId>` — change an existing step's text
- `NEW scenario` — create a whole new `.feature` file
- `REMOVE step <checkId>` — delete a step
- `(deferred) <anything>` — record but don't write

For each non-deferred entry:

1. Resolve the target file. If it's `NEW scenario`, the file is the
   one named in the entry (must not exist yet).
2. Apply the edit. For ADD/MODIFY/REMOVE, parse the surrounding step
   structure to find the right insertion point. For NEW, write the
   file using the skeleton from `templates/skills/verify/phases/scenario-template.md`.
3. Verify the result by re-reading the file. The pathHash of any
   modified step changes — that's expected (per CONVENTIONS.md the
   cache will invalidate downstream verdicts).

## AC enforcement

Each Verify Plan entry maps to an implicit acceptance criterion:
"the feature-file edit was written." If `/execute` finishes its
implementation loop but a Verify Plan edit didn't land, mark that
AC unmet in the verification breadcrumb.

The code change itself can still ship — Verify Plan failures are
acceptance failures, not blockers — but the user sees the unmet AC
when they review the breadcrumb. The `/debrief` integration's
`verify-coverage` phase catches this even if the user misses it.

## Failure handling

If a feature-file edit can't be applied (e.g., the anchor step
described in `ADD step after <anchor>` doesn't exist in the file):

1. Print a warning naming the file, the edit, and the reason
2. Mark the corresponding AC unmet in the breadcrumb's `deviations`
   array
3. Continue with the next entry — don't fail the whole execute pass

The user resolves these in a follow-up `/verify update <fid>` invocation
after the code change lands.

## NEW scenario handling

When the entry is `NEW scenario`, the feature file must not exist
yet. If it does, escalate:

> Verify Plan proposes a NEW scenario at features/13-first-time-user.feature
> but that file already exists. Did you mean ADD step or MODIFY?
> Skipping this entry — fix the plan and re-run.

NEW scenarios use the scaffolding shape from `phases/scenario-template.md`
of `/verify`. Pull the template content and substitute the scenario
name, persona tag, cost tag, and a starter journey from the entry's
prose.
