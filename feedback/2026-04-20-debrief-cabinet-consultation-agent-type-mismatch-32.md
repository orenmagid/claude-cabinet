---
type: field-feedback
source: claude-cabinet (dogfood, /debrief)
date: 2026-04-20
component: templates/skills/debrief/SKILL.md step 3 (Cabinet Consultations); also orient step 8
---

## Cabinet consultation step prescribes Agent subagent spawning but cabinet members aren't registered subagent types

**Friction:** Debrief step 3 ("Cabinet Consultations") and orient step 8
tell Claude to spawn cabinet members like this:

> "For each matching member, spawn an agent with: the member's full
> SKILL.md... the member's `directives.debrief` as the task"

which reads naturally as `Agent(subagent_type: "cabinet-record-keeper",
...)`. In current Claude Code, only pre-registered subagent types are
valid for the Agent tool. Cabinet members defined as `.claude/skills/
cabinet-*/SKILL.md` are **Skill-invokable**, not Agent-subagent-typed.
Attempting to spawn them returns:

> Agent type 'cabinet-record-keeper' not found. Available agents:
> claude-code-guide, Explore, general-purpose, Plan, statusline-setup

Dogfooded this session: hit three failures in parallel (record-keeper,
system-advocate, historian) during debrief of the v0.24.0 release.
Every consumer's next debrief or orient will trip on the same wall —
especially once a project has several cabinet members with the relevant
standing mandate.

**Workaround I used:** ran the three passes inline as the main agent
(reading the cabinet member's SKILL.md mentally and applying its lens).
Works but loses the parallelism and the isolation the skeleton
prescribes.

**Suggestion:** Either
(a) rewrite step 3 to invoke via `Skill(skill: "cabinet-<name>")` —
    keeps parallelism if multiple Skill calls can co-run, and uses the
    actual invocation surface cabinet members were built for; or
(b) the installer registers each cabinet member as a real subagent
    (writes to an agents manifest the Agent tool reads); or
(c) fall through to inline execution with a clear instruction: "read
    cabinet-<name>/SKILL.md, apply its lens to the session inventory,
    report under N words."

Same fix needs to land in orient step 8 and anywhere else the skeleton
prescribes cabinet-consultation-by-spawn.

**Session context:** /debrief after publishing v0.24.0 in the CC source
repo. Three agent spawns failed back-to-back; session continued via
inline workaround.
