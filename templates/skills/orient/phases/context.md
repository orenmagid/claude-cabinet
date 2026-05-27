# Context — What to Read at Session Start

Define what files and state to load so the session starts with a model
of where things stand. The /orient skill reads this file and loads each
item before proceeding.

When this file is absent or empty, the default behavior is: read the
project's root CLAUDE.md, system-status.md, and enforcement patterns
from `.claude/memory/patterns/`. To explicitly skip context loading,
write only `skip: true`.

## Default Context Sources

### System Status
```
Read system-status.md
```
The single-source-of-truth for what's built, what's broken, and what's
next. Read every session — it's the fastest way to know where things
stand.

### Enforcement Patterns
```
Scan .claude/memory/patterns/ — read each pattern file.
```
Project-level feedback from prior sessions. These are consolidated
observations about what works and what doesn't — they guide behavior
so the same mistakes aren't repeated. Patterns with `enforcement: guide`
are behavioral rules. Patterns with `enforcement: prevent` or `detect`
should already be encoded as hooks or rules, but reading them provides
context for why those guardrails exist.

### Sibling Projects
```
Read ~/.claude/cc-registry.json if it exists.
```
If the user has other CC projects, note them. Don't deep-read them,
but know they exist — if work in this session touches something that
relates to another project, mention it. "This API change might affect
your investor-reports project too."

### Built-In Memory Index

Read `MEMORY.md` from the project's memory dir (resolved via
`autoMemoryDirectory` setting if present, else
`~/.claude/projects/<dashified-cwd>/memory/MEMORY.md`). The index is
loaded by Claude Code automatically at session start (up to 200 lines
/ 25KB), so this step is normally already done — but during orient,
glance at the index sections and load topic files whose descriptions
match the session's likely focus.

For example, if the user's first message hints at memory architecture
work, read `decisions.md` (or the relevant individual file under
"Curated entries"). If they mention a sibling project, read the
corresponding `cross-{project}.md`.

Topic-file descriptions in MEMORY.md exist for exactly this purpose:
they tell Claude *when* to read each file. Use them.

To check the memory dir's structural health, run:
```bash
node scripts/validate-memory.mjs --quiet || true
```
Surface any violations under "Attention Items" in the briefing. The
validator catches orphan files, broken references, and exceeded caps.

## Additional Context Sources

Uncomment and adapt these for your project:

<!--
### Memory Index
```
Read .claude/memory/MEMORY.md for the index, then load files relevant
to the session's likely focus.
```
If your project uses a memory index beyond patterns (user context,
project state, references), scan the index and load what's relevant.
Don't read everything — selective loading based on session focus.

### Project-Specific State
```
Read config/project-state.yaml
```
Whatever your project uses to track configuration, feature flags,
environment state, or deployment status. Anything that changes between
sessions and affects how you work.
-->
