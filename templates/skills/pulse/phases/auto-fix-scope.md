# Auto-Fix Scope — What Can Be Fixed Automatically

Define what pulse is allowed to correct without asking. The /pulse skill
reads this file to determine its auto-fix boundaries.

When this file is absent or empty, the default behavior is: auto-fix
numeric counts only. Everything else is reported but not changed.
To explicitly disable all auto-fix, write only `skip: true`.

## The Closed-List Principle

Pulse only auto-fixes what's mechanically verifiable. The question is
not "can I fix this?" but "is there exactly one correct value?"

- A count is either right or wrong → auto-fix
- A date is either current or stale → auto-fix
- A description is a matter of judgment → report only
- A dead reference could mean rename, delete, or rethink → report only

When you expand auto-fix scope, you're asserting that the fix requires
zero human judgment. Be conservative — a wrong auto-fix is worse than
a reported discrepancy.

## Example Expanded Scope

Uncomment and adapt for your project:

<!--
### Numeric Counts (default)
Update documented counts to match actual counts.

### Date Stamps
Update "last verified" dates in cabinet member SKILL.md files after
a successful pulse check confirms they're still accurate.

### Known Renames
If a file was renamed (git log shows the rename) and a reference
still uses the old path, update the reference. Only when the git
history unambiguously shows a 1:1 rename, not a split or merge.
-->
