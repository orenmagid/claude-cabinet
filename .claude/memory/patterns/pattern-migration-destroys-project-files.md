---
name: pattern-migration-destroys-project-files
description: Migration operations that touch the filesystem broadly can destroy project-specific files when the manifest boundary is not enforced during migration
type: pattern
sources:
  - v0.6.8 migration incident (commit 209f9f4 in Flow)
enforcement: prevent
promotion_candidates:
  - Pre-commit hook in consuming projects that checks for deletion of non-manifest files
  - Installer pre-cleanup validation that blocks deletion of project-owned paths
---

## Principle

The manifest boundary (upstream-owned vs project-owned) must be enforced
during ALL operations that modify the filesystem, including migrations
and upgrades. The cleanup loop in the installer is the single most
dangerous code path — it can delete files based on manifest key mismatches
that result from directory renames, not actual file removal.

## Rules

- **The installer ONLY deletes files it can prove came from CC templates.**
  If a file is in the old manifest but doesn't map to any current template
  path, it must not be deleted.
- **Phase files with custom content are never overwritten.** The skipPhases
  flag is the primary guard; the content-comparison guard in copy.js is
  the backup.
- **Project-created skill directories are untouchable.** Any skill directory
  not in the CC template set belongs to the project.
- **All destructive operations require itemization and confirmation.**
  The user must see exactly what will be deleted before it happens.
- **Backups before deletions.** .cc-backup/<timestamp>/ preserves files
  before removal.

## When This Applies

Any time the installer runs — fresh install, upgrade, reset. The
safeguards are always-on, not conditional on version jumps.

## Incident Record

**Date:** 2026-04-06 (discovered 2026-04-07)
**Commit:** 209f9f4 in Flow repo
**Impact:** 25 deleted skills, 33 overwritten phases, 10 deleted phases
**Root cause:** perspectives-to-cabinet rename changed manifest keys,
cleanup loop treated all old keys as deletable
**Fix:** S1 (classify), S2 (scope), S3 (itemize), S4 (backup),
manifest key migration, project-skill guard, phase file guard
