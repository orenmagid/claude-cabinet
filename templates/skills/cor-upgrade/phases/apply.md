# Apply — Execute Approved Changes

Apply the changes approved during the merge conversation. Each change
type has a specific application method.

When this file is absent or empty, the default behavior is: apply each
approved change using the type-appropriate method below, commit after
each logical group, and present a summary. To explicitly skip applying
(dry-run mode where merge proposes but nothing is written), write only
`skip: true`.

## Application Methods

### Skeleton SKILL.md Updates

Copy the updated SKILL.md from upstream to the project's `.claude/skills/`
directory. The project's `phases/` directory is untouched — only the
skeleton orchestration file changes.

Before copying, verify:
- The project's phase files still exist and are intact
- The new skeleton's phase references match the phase files that exist
- If the new skeleton references a phase the project doesn't have,
  note it (the project will use the default behavior)

### Phase File Collaborative Edits

When a merge proposal includes changes to a phase file (always with
user approval):
- Show the exact diff before writing
- Make the edit
- Read back the result so the user can verify

Never bulk-replace a phase file. Edits are surgical and approved.

### Schema Migrations

- Present the SQL one more time before executing
- Run the migration against the project's database
- Verify the schema change took effect (query the table structure)
- If migration fails, report the error — don't retry or attempt fixes
  without user input

### New Skills

- Copy the skeleton SKILL.md from upstream
- Create an empty `phases/` directory
- Do NOT copy upstream example phase files — the project starts fresh
  and customizes from the skeleton's defaults
- Note the new skill in the summary so the user knows to customize it

### New Perspectives

- Copy new perspective files to the project's perspective directory
- If the project has a group configuration, note the new perspective
  but don't auto-add it to any group — the user decides placement

### New Hooks or Rules

- Present the hook/rule configuration
- Add to `.claude/settings.json` or `.claude/rules/` after confirmation
- If the project has existing hooks that might conflict, flag it

## Commit Strategy

Commit after each logical group of changes:
- All skeleton updates in one commit
- Schema migrations in a separate commit (easy to revert)
- New skills in a separate commit
- Phase file edits in a separate commit (clearly separated from
  skeleton changes)

Commit messages should describe what was upgraded:
"Upgrade orient + debrief skeletons from upstream CoR"
"Add trigger_condition column (CoR schema migration)"
"Adopt /validate skill from CoR"

## Summary

After all changes are applied, present:
- **Applied:** what was changed, with commit references
- **Skipped:** what the user chose not to adopt, with their reasons
  (useful context for the next upgrade)
- **Review next:** suggestions for customization — new skills that
  need phase files, new phases that might benefit from project-specific
  content, perspectives to consider adding to groups
