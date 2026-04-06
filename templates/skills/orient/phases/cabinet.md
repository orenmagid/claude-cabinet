# Cabinet Members — Which Expert Lenses to Activate

Define which cabinet members (expert evaluation lenses) should be active
during this session. Active cabinet members watch for specific concerns
throughout the session without being explicitly invoked for each decision.

When this file is absent or empty, this step is skipped. (`skip: true`
is equivalent to absent here.)

## What to Include

For each cabinet member, provide:
- **Name** — the cabinet member to activate
- **Path** — where the cabinet member's SKILL.md lives
- **When active** — always, or only under certain conditions
- **What it watches for** — the concern this lens monitors

## Example Cabinet Member Configurations

Uncomment and adapt these for your project:

<!--
### Always-On Cabinet Members

These activate every session regardless of focus:

**QA** (`.claude/skills/cabinet-qa/SKILL.md`):
Watches for untested changes, missing edge cases, and quality gaps.
Active whenever code is being written or modified.

**Workflow Cop** (`.claude/skills/cabinet-workflow-cop/SKILL.md`):
Watches for process deviations — skipped steps, missing validation,
undocumented decisions. Active every session.

### Conditional Cabinet Members

These activate based on session context:

**Security** (`.claude/skills/cabinet-security/SKILL.md`):
Activate when the session involves authentication, data handling,
external APIs, or user input processing.

**Speed Freak** (`.claude/skills/cabinet-speed-freak/SKILL.md`):
Activate when the session involves database queries, rendering logic,
or data processing at scale.
-->
