# Phase-customization guard can't distinguish "user customized" from
# "user has stale upstream"

**Surfaced:** 2026-05-15 during 0.25.3 work shipping `/verify backfill`
**Severity:** medium — silent regression risk; legitimate upstream
phase improvements never reach upgrading consumers
**Classification:** detect (manifest-aware variant), or document
(accept tradeoff)

## What went wrong

The phase-customization guard in `copy.js:48-59` (and mirrored in
`cli.js`'s single-file install path) says: "if a phase file on disk
differs from the upstream template and isn't empty, preserve it."

The intent is to protect user edits. The side effect: when upstream
ships a new version of a phase file, an already-installed consumer
will NEVER pick up the new version through `cc-upgrade` — the guard
preserves the stale upstream copy because it "differs from current
upstream."

Caught while shipping a v0.25.3 edit to
`templates/skills/orient/phases/verify-backfill.md` (changed the
suggested command from `/plan <fid>` to `/verify backfill <fid>`).
De[sic]ify's installed copy stayed on the v0.25.2 hint until manually
deleted.

## Why the obvious fix doesn't work

The intuitive refinement — "if on-disk hash equals manifest hash,
the user didn't customize; overwrite" — fails because the manifest
stores `hashContent(existing)` on preserve. So after one preserve
cycle, manifest == on-disk forever, and the next upgrade would treat
a genuinely-customized file as "matches manifest, must be stale
upstream — overwrite." Direct regression of the original
preservation invariant.

Tried in 0.25.3 and reverted after the seed/phases/build-member.md
case demonstrated the regression in dry-run.

## What the real fix looks like

The manifest needs to store **two** hashes per phase file:
1. `installedUpstreamHash` — the upstream version we last shipped here
2. `onDiskHash` — what's actually on disk after preserve

Then the guard can answer the right question:
- If `onDiskHash == installedUpstreamHash`: user never edited — safe
  to overwrite with new upstream
- If `onDiskHash != installedUpstreamHash`: user customized — preserve
- Either way, update `installedUpstreamHash` to the new upstream hash
  so the next cycle has fresh comparison data

This is a schema change on `.ccrc.json`'s manifest format. Worth
doing — it's the difference between "phase customization mostly
works" and "phase customization is a sound invariant under
upgrades."

## Current workaround

Until the manifest is upgraded, consumers who want an upstream phase
update must:
1. Delete the local phase file
2. Re-run `cc-upgrade` — the file copies fresh

Or accept that prompt-level phase changes won't reach them
automatically.

## Why this matters for /verify

The verify module is the heaviest user of customization phases
(verify-plan, verify-emit, verify-coverage, verify-backfill,
ui-paths). Every prompt-level improvement to those phases hits this
wall. The longer the module is in 0.x territory, the more iterations
get silently stranded on installed consumers.

## How to promote

Manifest-schema fix is a v0.26 candidate. Until then, every CC
release that ships phase-file changes should include a release note
listing which phase files changed, so consumers know which ones to
delete-and-re-upgrade.
