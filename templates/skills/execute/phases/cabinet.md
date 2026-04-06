# Cabinet Members — Which to Activate for Execution

Define which cabinet members to activate during plan execution, any
always-on cabinet members, and any project-specific checkpoint rules.
The /execute skill reads this file when selecting cabinet members for
the three checkpoint stages.

When this file is absent or empty, the default behavior is: scan all
cabinet members in `.claude/skills/cabinet-*/SKILL.md`, activate those
whose convening criteria match the plan's surface area or topic keywords.
To explicitly skip all cabinet member checkpoints (even if cabinet members
exist), write only `skip: true`.

If no cabinet members exist in the project, checkpoints are skipped regardless.

## What to Include

- **Always-on cabinet members** — cabinet members that activate for every
  execution regardless of surface area
- **Checkpoint-specific rules** — which cabinet members at which checkpoints
  (pre-implementation, per-file-group, pre-commit)
- **Escalation overrides** — stricter or more lenient than default
- **Performance tuning** — skip per-file-group checkpoints for small plans,
  or reduce to pre-commit only for low-risk changes

## Example Cabinet Member Configurations

Uncomment and adapt these for your project:

<!--
### Always-On for Execution
These cabinet members activate at every checkpoint:
- boundary-man — catches edge cases in implementation
- qa — tracks acceptance criteria throughout

### Checkpoint-Specific Rules
- Pre-implementation (Checkpoint 1): all activated cabinet members
- Per-file-group (Checkpoint 2): only cabinet members matching changed files
- Pre-commit (Checkpoint 3): all activated cabinet members (full sweep)

### Performance Tuning
For plans with surface area <= 3 files, skip per-file-group checkpoints
(Checkpoint 2) and go straight to pre-commit sweep. The overhead of
multiple checkpoints isn't justified for small changes.

### Escalation Overrides
- Security **stop** → always halt, no bypass without explicit user ack
- QA **pause** for failing AC → escalate to stop (AC failures are blocking)
-->
