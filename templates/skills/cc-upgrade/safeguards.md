# cc-upgrade Safeguards, Invariants, and History

The installer's cleanup loop — the code that removes files no longer in
the upstream manifest — is the single most dangerous code path in CC.
This file documents the safeguards that prevent it from destroying
project-owned files, the invariants those safeguards enforce, and the
incident that taught us why they're needed.

## Safeguards

Six safeguards prevent the cleanup loop from destroying project-owned
files:

1. **Classification (S1).** Before removing a file, verify it maps to a
   known CC template path. Build the complete template path set across ALL
   modules. If a file in the old manifest doesn't correspond to any current
   template, it's either project-created or a renamed path — don't delete.

2. **Module scoping (S2).** Only delete files from modules the user
   selected for this install. Running `--lean` on a full installation does
   NOT purge non-lean module files. Deselected module files stay untouched.

3. **Itemization (S3).** All files that would be removed are listed with
   their paths before any deletion occurs. Without `--yes`, the user must
   explicitly confirm. `--dry-run` lists what would be removed without
   touching anything.

4. **Backup (S4).** Before any deletion, all targeted files are copied to
   `.cc-backup/<timestamp>/`. If something goes wrong, the backup is a
   complete recovery point.

5. **Manifest key migration.** When CC renames directories (e.g.,
   `perspectives/` → `cabinet-*/`), old manifest keys are migrated to new
   keys BEFORE the cleanup loop runs. This prevents the loop from treating
   every renamed file as "removed upstream."

6. **Project-skill guard.** Any skill directory not in the CC template set
   is project-owned. The cleanup loop will never delete files inside
   project-created skills, even if they somehow appear in the manifest.

Additionally, **phase files** have independent protection in the copy
logic: if a phase file on disk has been customized (content differs from
the template and isn't empty), it is never overwritten — regardless of
the `skipPhases` flag.

## Invariants

These contracts must never be violated by the installer:

- **The installer ONLY modifies files it can prove came from CC templates.**
  If a file can't be traced to a template path, it's hands-off.
- **Phase files are NEVER overwritten if they contain custom content.**
  The `skipPhases` flag is the primary guard; the content-comparison guard
  in `copy.js` is the independent backup.
- **Project-created skill directories are NEVER deleted.** Any skill
  directory not in the CC template set belongs to the project.
- **All destructive operations are itemized and require confirmation.**
  The user sees exactly what will be deleted before it happens.
- **Backups are created before any deletion.** `.cc-backup/<timestamp>/`
  preserves every file before removal.
- **Manifest keys are migrated before cleanup.** Directory renames in new
  versions trigger key migration so the cleanup loop sees continuity.

## Lessons Learned

**v0.6.8 migration incident (2026-04-06).** The `perspectives/` →
`cabinet-*/` directory rename changed manifest keys, causing the cleanup
loop to see every old key as "not in new manifest." The loop deleted 25
project-specific skills, overwrote 43 phase customizations, and deleted
10 phase files in a consuming project. Root cause: the cleanup loop had
no concept of project-owned files — it treated any old manifest key not
in the new manifest as deletable, and the only guard was a `/phases/`
regex. Fixed by adding classification, scoping, itemization, backup,
manifest key migration, project-skill guard, and phase file guard.
