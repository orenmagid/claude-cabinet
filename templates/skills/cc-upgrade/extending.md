# cc-upgrade Phase Summary, Triggers, and Extending

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `pre-upgrade.md` | Default: read .ccrc.json, note phase files, note _briefing.md | Pre-upgrade state capture |
| `explain-changes.md` | Default: semantic summary of version jump, changed skeletons, new files | How to present what changed |
| `adapt.md` | Default: _briefing.md sections, phase implications, schema, new modules | How to handle non-manifest concerns |

## Proactive Trigger

The upgrade skill doesn't have to wait for the user to invoke it.
Orient can detect when upstream CC has a newer version than what's
in `.ccrc.json` and surface "CC updates available" in the briefing.
This is a hint, not a blocker — the user decides when to run /cc-upgrade.

The drift check script (`scripts/cc-drift-check.cjs`) can also detect
if manifest-tracked files have been modified outside the installer,
though the upstream guard hook should prevent this during normal
Claude Code operation.

## Extending

To customize a phase: write content in the corresponding `phases/` file.
To skip a phase: write only `skip: true`.
To add a phase the skeleton doesn't define: create a new file in
`phases/` with a description of when it runs relative to the core
phases. Claude reads whatever phase files exist at runtime.

Examples of phases mature projects add:
- Changelog generation (produce a human-readable summary of what changed)
- Rollback plan (capture how to revert each change if something breaks)
- Downstream notification (update team members about process changes)
- Compatibility check (verify that project extensions still work after
  skeleton updates)
