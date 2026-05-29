# `--modules` flag replaced enabled modules instead of merging on upgrade

**Surfaced:** 2026-05-15 during milestone 7b dry-run on de[sic]ify
**Severity:** medium — silent data loss (modules deregistered without
confirmation), but recoverable on next install
**Classification:** prevent (the prior logic structurally allowed the
wrong outcome)

## What went wrong

Running `npx create-claude-cabinet --yes --dry-run --modules verify`
against a project that already had `.ccrc.json` listing 9 enabled
modules (session-loop, hooks, work-tracking, planning, compliance,
audit, lifecycle, validate, memory) reported:

```
Installing modules: session-loop, verify
Skipped modules: hooks, work-tracking, planning, compliance, audit,
                 lifecycle, validate, memory
```

On a real (non-dry) run, that would have rewritten `.ccrc.json` with
only 2 modules enabled, deregistering 7 in-use modules silently. Phase
files would have been preserved (the guard catches that), but the
manifest would be wrong and the installer would no longer keep those
modules' files in sync.

## Root cause

`lib/cli.js` `--modules` handler took the requested keys as the
**complete** set: `selectedModules = [mandatoryKeys, ...requested]`.
No consideration of the existing `.ccrc.json` `modules` map. Same
code path for both fresh installs (correct behavior — nothing to
carry forward) and upgrades (incorrect — overwrites the existing set).

## Fix

Patched `lib/cli.js` to read existing modules from `.ccrc.json` when
`dirState === 'existing-install'` and union them with the
`--modules`-requested keys. Mandatory + existing + requested → final
set. Fresh installs unchanged.

Output now reads:

```
Existing modules carried forward: session-loop, hooks, work-tracking, ...
Installing modules: session-loop, hooks, work-tracking, ..., verify
```

## Why this is a candidate for promotion

The failure mode was silent and irreversible without manual recovery.
"Add a module to an existing install" is the *most common* `--modules`
use case — the prior behavior was wrong for that case. Worth a regression
test in lib/cli.test.js if/when that file exists.

## How it surfaced

Caught during pre-publish dry-run while wiring the new `verify` module
into de[sic]ify (milestone 7b of the cabinet-verify extraction). Would
have been caught later by the project itself — `.ccrc.json` getting
mysteriously truncated — but pre-publish dry-run was the right place
to find it.
